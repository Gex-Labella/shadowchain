/**
 * Component for managing social account connections
 * Cyberpunk-noir aesthetic with glitch effects
 */

import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { oauthService, Connection } from '../services/oauth';

export const AccountConnections: React.FC = () => {
  const { selectedAccount } = useWalletStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError('CONNECTION_ERROR: Failed to load connections');
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
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setActiveConnection(null);
      }, 120000);
    } catch (err: any) {
      setError(`ERROR_403: ${err.response?.data?.error || 'GitHub connection failed'}`);
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
    } catch (err) {
      setError('DISCONNECT_FAILED: Unable to revoke connection');
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
    <div className="shadow-card" style={{ marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--shadow-steel)'
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
          letterSpacing: '0.05em',
          color: 'var(--ghost-white)',
          margin: 0
        }}>
          WEB2 CONNECTIONS
        </h3>
        <span style={{
          marginLeft: '1rem',
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          background: 'rgba(0, 245, 255, 0.1)',
          border: '1px solid var(--neon-cyan)',
          borderRadius: 'var(--radius-sharp)',
          color: 'var(--neon-cyan)',
          fontFamily: 'var(--font-mono)'
        }}>
          {connections.length} ACTIVE
        </span>
      </div>
      
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'rgba(208, 0, 0, 0.1)',
          border: '1px solid var(--error-crimson)',
          borderRadius: 'var(--radius-sharp)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.813rem',
          color: 'var(--error-crimson)'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* GitHub Connection */}
        <div 
          className="data-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem',
            background: 'linear-gradient(135deg, var(--shadow-ink), var(--shadow-carbon))',
            border: `1px solid ${isConnected('github') ? 'var(--corrupt-green)' : 'var(--shadow-steel)'}`,
            borderRadius: 'var(--radius-broken)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Scanning line effect for active connection */}
          {activeConnection === 'github' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, var(--neon-violet), transparent)',
              animation: 'scan 2s linear infinite'
            }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isConnected('github') ? 'rgba(57, 255, 20, 0.1)' : 'var(--shadow-void)',
              border: `1px solid ${isConnected('github') ? 'var(--corrupt-green)' : 'var(--neon-violet)'}`,
              borderRadius: 'var(--radius-sharp)',
              color: isConnected('github') ? 'var(--corrupt-green)' : 'var(--neon-violet)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-tech)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--ghost-white)',
                letterSpacing: '0.05em',
                margin: 0
              }}>
                GITHUB
              </p>
              {isConnected('github') ? (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--corrupt-green)',
                  margin: 0
                }}>
                  @{connections.find(c => c.service === 'github')?.username}
                </p>
              ) : (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--static-gray)',
                  margin: 0
                }}>
                  NOT_CONNECTED
                </p>
              )}
            </div>
          </div>
          
          {isConnected('github') ? (
            <button
              onClick={() => disconnect('github')}
              disabled={loading}
              className="btn-shadow"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.75rem',
                borderColor: 'var(--error-crimson)',
                background: 'transparent'
              }}
            >
              <span style={{ color: 'var(--error-crimson)' }}>REVOKE</span>
            </button>
          ) : (
            <button
              onClick={connectGitHub}
              disabled={loading || activeConnection === 'github'}
              className="btn-neon"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.75rem'
              }}
            >
              {activeConnection === 'github' ? 'CONNECTING...' : 'CONNECT'}
            </button>
          )}
        </div>

        {/* Twitter/X Connection */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem',
            background: 'linear-gradient(135deg, var(--shadow-ink), var(--shadow-carbon))',
            border: '1px solid var(--shadow-steel)',
            borderRadius: 'var(--radius-broken)',
            opacity: 0.5,
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--shadow-void)',
              border: '1px solid var(--shadow-steel)',
              borderRadius: 'var(--radius-sharp)',
              color: 'var(--static-gray)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
              </svg>
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-tech)',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--ghost-white)',
                letterSpacing: '0.05em',
                margin: 0
              }}>
                X / TWITTER
              </p>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--static-gray)',
                margin: 0
              }}>
                COMING_SOON
              </p>
            </div>
          </div>
          
          <button
            disabled
            className="btn-shadow"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.75rem',
              opacity: 0.3,
              cursor: 'not-allowed'
            }}
          >
            <span>UNAVAILABLE</span>
          </button>
        </div>
      </div>

      {/* Privacy Terminal */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'var(--shadow-void)',
        border: '1px solid var(--shadow-steel)',
        borderRadius: 'var(--radius-sharp)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem'
      }}>
        <div style={{ color: 'var(--corrupt-green)', marginBottom: '0.5rem' }}>
          $ cat privacy.txt
        </div>
        <div style={{ color: 'var(--ghost-white)', opacity: 0.8, lineHeight: 1.6 }}>
          [PRIVACY_PROTOCOL]<br />
          • OAuth tokens: AES-256-GCM encrypted<br />
          • Access scope: Public repositories only<br />
          • Revocation: Instant + permanent delete<br />
          • Storage: IPFS with client-side encryption<br />
          • Keys: Never leave your device
        </div>
        <div style={{ 
          color: 'var(--static-gray)', 
          marginTop: '0.5rem',
          animation: 'blink 1s infinite' 
        }}>
          _
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};