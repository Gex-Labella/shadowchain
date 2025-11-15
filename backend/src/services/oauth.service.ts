/**
 * OAuth Service for managing user OAuth connections
 */

import axios from 'axios';
import crypto from 'crypto';
import config from '../config';
import { authLogger as logger } from '../utils/logger';
import { substrateService } from './substrate.service';

export interface OAuthToken {
  userAddress: string;
  service: 'github' | 'twitter';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  accountId?: string;
  accountUsername?: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

// In-memory storage for demo (in production, use encrypted database)
const tokenStore = new Map<string, OAuthToken>();

export class OAuthService {
  private readonly githubAuthUrl = 'https://github.com/login/oauth/authorize';
  private readonly githubTokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly githubApiUrl = 'https://api.github.com';

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  generateState(userAddress: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    // Store state temporarily (in production, use Redis with TTL)
    const key = `oauth_state:${state}`;
    tokenStore.set(key, { userAddress, service: 'github' } as OAuthToken);
    return state;
  }

  /**
   * Validate OAuth state parameter
   */
  validateState(state: string): string | null {
    const key = `oauth_state:${state}`;
    const data = tokenStore.get(key);
    if (data) {
      tokenStore.delete(key);
      return data.userAddress;
    }
    return null;
  }

  /**
   * Get GitHub authorization URL
   */
  getGitHubAuthUrl(userAddress: string): string {
    const state = this.generateState(userAddress);
    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: config.githubCallbackUrl,
      scope: 'repo user:email',
      state,
    });
    return `${this.githubAuthUrl}?${params.toString()}`;
  }

  /**
   * Exchange GitHub code for access token
   */
  async exchangeGitHubCode(code: string, state: string): Promise<OAuthToken | null> {
    try {
      // Validate state
      const userAddress = this.validateState(state);
      if (!userAddress) {
        logger.error('Invalid OAuth state');
        return null;
      }

      // Exchange code for token
      const response = await axios.post(
        this.githubTokenUrl,
        {
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
          redirect_uri: config.githubCallbackUrl,
        },
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      const { access_token, scope, token_type } = response.data;

      if (!access_token) {
        logger.error('No access token received from GitHub');
        return null;
      }

      // Get user info
      const userInfo = await this.getGitHubUserInfo(access_token);

      // Create token object
      const token: OAuthToken = {
        userAddress,
        service: 'github',
        accessToken: access_token,
        scope,
        accountId: userInfo.id.toString(),
        accountUsername: userInfo.login,
      };

      // Store token (encrypted in production)
      await this.storeToken(token);

      logger.info({
        userAddress,
        username: userInfo.login,
      }, 'GitHub OAuth token stored');

      return token;
    } catch (error) {
      logger.error({ error }, 'Failed to exchange GitHub code');
      return null;
    }
  }

  /**
   * Get GitHub user info
   */
  async getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
    const response = await axios.get(`${this.githubApiUrl}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return response.data;
  }

  /**
   * Store OAuth token (encrypted in production)
   */
  async storeToken(token: OAuthToken): Promise<void> {
    // In production:
    // 1. Encrypt the access token using user's public key
    // 2. Store in database with proper indexes
    // 3. Set up token rotation if refresh tokens are available
    
    const key = `${token.userAddress}:${token.service}`;
    tokenStore.set(key, token);
  }

  /**
   * Get OAuth token for user
   */
  async getToken(userAddress: string, service: 'github' | 'twitter'): Promise<OAuthToken | null> {
    const key = `${userAddress}:${service}`;
    return tokenStore.get(key) || null;
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(userAddress: string, service: 'github' | 'twitter'): Promise<boolean> {
    try {
      const token = await this.getToken(userAddress, service);
      if (!token) {
        return false;
      }

      if (service === 'github') {
        // GitHub token revocation
        await axios.delete(
          `${this.githubApiUrl}/applications/${config.githubClientId}/token`,
          {
            auth: {
              username: config.githubClientId,
              password: config.githubClientSecret,
            },
            data: {
              access_token: token.accessToken,
            },
          }
        );
      }

      // Remove from storage
      const key = `${userAddress}:${service}`;
      tokenStore.delete(key);

      logger.info({
        userAddress,
        service,
      }, 'OAuth token revoked');

      return true;
    } catch (error) {
      logger.error({ error, userAddress, service }, 'Failed to revoke token');
      return false;
    }
  }

  /**
   * Get user's connected accounts
   */
  async getConnectedAccounts(userAddress: string): Promise<Array<{
    service: string;
    username: string;
    connectedAt: Date;
  }>> {
    const connections = [];
    
    const githubToken = await this.getToken(userAddress, 'github');
    if (githubToken) {
      connections.push({
        service: 'github',
        username: githubToken.accountUsername || 'Unknown',
        connectedAt: new Date(), // In production, store this timestamp
      });
    }

    return connections;
  }

  /**
   * Check if user has valid GitHub token
   */
  async hasValidGitHubToken(userAddress: string): Promise<boolean> {
    const token = await this.getToken(userAddress, 'github');
    if (!token) {
      return false;
    }

    try {
      // Validate token by making a simple API call
      await axios.get(`${this.githubApiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });
      return true;
    } catch (error) {
      // Token is invalid or expired
      return false;
    }
  }

  /**
   * Get all users with OAuth tokens
   * Used by the fetcher service to find users to sync
   */
  async getAllUsersWithTokens(): Promise<string[]> {
    const users: string[] = [];
    
    // Get all users from the token store
    for (const [key, token] of tokenStore.entries()) {
      // Skip OAuth state entries
      if (key.startsWith('oauth_state:')) continue;
      
      // Extract user address from key (format: "userAddress:service")
      const [userAddress] = key.split(':');
      if (userAddress && !users.includes(userAddress)) {
        users.push(userAddress);
      }
    }
    
    return users;
  }

  /**
   * Get GitHub access token for a user
   */
  async getGitHubToken(userAddress: string): Promise<string | null> {
    const token = await this.getToken(userAddress, 'github');
    return token?.accessToken || null;
  }
}

// Export singleton instance
export const oauthService = new OAuthService();