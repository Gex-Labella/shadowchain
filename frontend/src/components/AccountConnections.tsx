/**
 * Component for managing social account connections
 */

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { oauthService, Connection } from '../services/oauth';
import { FaGithub, FaTwitter, FaLink, FaUnlink } from 'react-icons/fa';

export const AccountConnections: React.FC = () => {
  const { selectedAccount } = useWalletStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAccount) {
      loadConnections();
    }
  }, [selectedAccount]);

  const loadConnections = async () => {
    if (!selectedAccount) return;

    try {
      setLoading(true);
      const conns = await oauthService.getConnections(selectedAccount.address);
      setConnections(conns);
    } catch (err) {
      setError('Failed to load connections');
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    if (!selectedAccount) return;

    try {
      setLoading(true);
      setError(null);
      const authUrl = await oauthService.connectGitHub(selectedAccount.address);
      // Open OAuth flow in new window
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Poll for connection status
      const checkConnection = setInterval(async () => {
        const hasToken = await oauthService.hasValidGitHubToken(selectedAccount.address);
        if (hasToken) {
          clearInterval(checkConnection);
          await loadConnections();
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(checkConnection), 120000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect GitHub');
      console.error('Failed to connect GitHub:', err);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async (service: string) => {
    if (!selectedAccount) return;

    try {
      setLoading(true);
      await oauthService.revokeConnection(selectedAccount.address, service);
      await loadConnections();
    } catch (err) {
      setError('Failed to disconnect');
      console.error('Failed to disconnect:', err);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'github':
        return <FaGithub className="w-5 h-5" />;
      case 'twitter':
        return <FaTwitter className="w-5 h-5" />;
      default:
        return <FaLink className="w-5 h-5" />;
    }
  };

  const isConnected = (service: string) => {
    return connections.some(conn => conn.service === service);
  };

  if (!selectedAccount) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Account Connections</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* GitHub Connection */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            <FaGithub className="w-6 h-6" />
            <div>
              <p className="font-medium">GitHub</p>
              {isConnected('github') ? (
                <p className="text-sm text-gray-600">
                  Connected as {connections.find(c => c.service === 'github')?.username}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Connect to sync your repositories
                </p>
              )}
            </div>
          </div>
          
          {isConnected('github') ? (
            <button
              onClick={() => disconnect('github')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50"
            >
              <FaUnlink />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={connectGitHub}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
            >
              <FaLink />
              <span>Connect</span>
            </button>
          )}
        </div>

        {/* Twitter Connection (Placeholder) */}
        <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
          <div className="flex items-center space-x-3">
            <FaTwitter className="w-6 h-6" />
            <div>
              <p className="font-medium">X (Twitter)</p>
              <p className="text-sm text-gray-600">
                Coming soon
              </p>
            </div>
          </div>
          
          <button
            disabled
            className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-500 rounded cursor-not-allowed"
          >
            <FaLink />
            <span>Connect</span>
          </button>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p className="font-medium mb-2">Privacy Notice:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Your OAuth tokens are encrypted and stored securely</li>
          <li>We only access public repository information</li>
          <li>You can revoke access at any time</li>
          <li>All data is encrypted before storage on IPFS</li>
        </ul>
      </div>
    </div>
  );
};