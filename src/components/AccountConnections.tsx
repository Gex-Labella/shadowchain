/**
 * Component for managing social account connections
 * Modern design with subtle tech aesthetics
 */

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { oauthService, Connection } from '../services/oauth';
import { toast } from 'react-toastify';

interface AccountConnectionsProps {
  onConnectionChange?: () => void;
}

export const AccountConnections: React.FC<AccountConnectionsProps> = ({ onConnectionChange }) => {
  const { selectedAccount } = useWalletStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeConnection, setActiveConnection] = useState<string | null>(null);

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
      toast.error('Failed to load connections');
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    if (!selectedAccount) return;

    try {
      setLoading(true);
      setActiveConnection('github');
      const authUrl = await oauthService.connectGitHub(selectedAccount.address);
      
      // Open OAuth flow in new window
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Poll for connection status
      const checkConnection = setInterval(async () => {
        const hasToken = await oauthService.hasValidGitHubToken(selectedAccount.address);
        if (hasToken) {
          clearInterval(checkConnection);
          await loadConnections();
          setActiveConnection(null);
          toast.success('GitHub connected successfully');
          
          if (onConnectionChange) {
            onConnectionChange();
          }
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setActiveConnection(null);
      }, 120000);
    } catch (err: any) {
      toast.error('Failed to connect GitHub');
      console.error('Failed to connect GitHub:', err);
      setActiveConnection(null);
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
      toast.info(`${service} disconnected`);
      
      if (onConnectionChange) {
        onConnectionChange();
      }
    } catch (err) {
      toast.error('Failed to disconnect');
      console.error('Failed to disconnect:', err);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = (service: string) => {
    return connections.some(conn => conn.service === service);
  };

  if (!selectedAccount) {
    return null;
  }

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Web2 Connections</h3>
          <p className="text-sm text-secondary">
            Connect your social accounts to archive your digital footprint
          </p>
        </div>
        <div className="badge badge-success">
          {connections.length} Active
        </div>
      </div>

      <div className="space-y-4">
        {/* GitHub Connection */}
        <div className={`p-4 rounded-lg border transition-all ${
          isConnected('github') 
            ? 'bg-accent-success/5 border-accent-success/30' 
            : 'bg-bg-tertiary border-border-default'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                isConnected('github')
                  ? 'bg-accent-success/10 text-accent-success'
                  : 'bg-bg-elevated text-tertiary'
              }`}>
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </div>
              
              <div>
                <h4 className="font-medium">GitHub</h4>
                {isConnected('github') ? (
                  <p className="text-sm text-accent-success">
                    @{connections.find(c => c.service === 'github')?.username}
                  </p>
                ) : (
                  <p className="text-sm text-tertiary">
                    Not connected
                  </p>
                )}
              </div>
            </div>
            
            {isConnected('github') ? (
              <button
                onClick={() => disconnect('github')}
                disabled={loading}
                className="btn btn-ghost text-danger"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectGitHub}
                disabled={loading || activeConnection === 'github'}
                className="btn btn-primary"
              >
                {activeConnection === 'github' ? (
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  'Connect'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Twitter/X Connection */}
        <div className="p-4 rounded-lg bg-bg-tertiary border border-border-default opacity-60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-bg-elevated text-tertiary flex items-center justify-center">
                <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
                </svg>
              </div>
              
              <div>
                <h4 className="font-medium">X / Twitter</h4>
                <p className="text-sm text-tertiary">
                  Coming soon
                </p>
              </div>
            </div>
            
            <button
              disabled
              className="btn btn-secondary opacity-50 cursor-not-allowed"
            >
              Unavailable
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-6 p-4 bg-bg-tertiary rounded-lg border border-border-default">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          
          <div className="text-sm text-secondary">
            <p className="font-medium text-primary mb-1">Privacy First</p>
            <ul className="space-y-1 text-xs">
              <li>• OAuth tokens are encrypted with AES-256-GCM</li>
              <li>• Only public repository access is requested</li>
              <li>• Revoke access anytime with instant deletion</li>
              <li>• Your keys never leave your device</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};