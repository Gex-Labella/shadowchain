/**
 * OAuth Service for handling social account connections
 */

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://54.197.131.122:3001';

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
    const response = await axios.post(`${API_BASE}/auth/github/connect`, {
      userAddress,
    });
    return response.data.authUrl;
  }

  /**
   * Get user's connected accounts
   */
  async getConnections(userAddress: string): Promise<Connection[]> {
    const response = await axios.get(`${API_BASE}/auth/connections/${userAddress}`);
    return response.data.connections.map((conn: any) => ({
      ...conn,
      connectedAt: new Date(conn.connectedAt),
    }));
  }

  /**
   * Revoke a connection
   */
  async revokeConnection(userAddress: string, service: string): Promise<void> {
    await axios.delete(`${API_BASE}/auth/connections/${userAddress}/${service}`);
  }

  /**
   * Check if user has a valid GitHub token
   */
  async hasValidGitHubToken(userAddress: string): Promise<boolean> {
    const response = await axios.get(`${API_BASE}/auth/github/status/${userAddress}`);
    return response.data.hasValidToken;
  }
}

export const oauthService = new OAuthService();