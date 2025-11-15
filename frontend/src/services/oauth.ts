/**
 * OAuth Service for handling social account connections
 */

import axios, { AxiosError } from 'axios';
import { config } from '../config/environment';

const API_BASE = config.api.baseUrl;

// Configure axios defaults
axios.defaults.timeout = config.api.timeout;
axios.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle common errors
    if (error.response?.status === 401) {
      console.error('Unauthorized request');
    }
    return Promise.reject(error);
  }
);

export interface Connection {
  service: string;
  username: string;
  connectedAt: Date;
}

export class OAuthService {
  /**
   * Initialize GitHub OAuth flow
   */
  async connectGitHub(userAddress: string): Promise<string> {
    try {
      const response = await axios.post(`${API_BASE}/auth/github/connect`, {
        userAddress,
      });
      return response.data.authUrl;
    } catch (error) {
      console.error('Failed to connect GitHub:', error);
      throw new Error('Failed to initialize GitHub connection');
    }
  }

  /**
   * Get user's connected accounts
   */
  async getConnections(userAddress: string): Promise<Connection[]> {
    try {
      const response = await axios.get(`${API_BASE}/auth/connections/${userAddress}`);
      return response.data.connections.map((conn: any) => ({
        ...conn,
        connectedAt: new Date(conn.connectedAt),
      }));
    } catch (error) {
      console.error('Failed to get connections:', error);
      return [];
    }
  }

  /**
   * Revoke a connection
   */
  async revokeConnection(userAddress: string, service: string): Promise<void> {
    try {
      await axios.delete(`${API_BASE}/auth/connections/${userAddress}/${service}`);
    } catch (error) {
      console.error('Failed to revoke connection:', error);
      throw new Error('Failed to revoke connection');
    }
  }

  /**
   * Check if user has a valid GitHub token
   */
  async hasValidGitHubToken(userAddress: string): Promise<boolean> {
    try {
      const response = await axios.get(`${API_BASE}/auth/github/status/${userAddress}`);
      return response.data.hasValidToken;
    } catch (error) {
      console.error('Failed to check GitHub token status:', error);
      return false;
    }
  }
}

export const oauthService = new OAuthService();