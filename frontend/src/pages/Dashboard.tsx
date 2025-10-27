import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { toast } from 'react-toastify';
import axios from 'axios';
import { AccountConnections } from '../components/AccountConnections';
import { getShadowItems, getConsentRecord, grantConsent } from '../services/polkadot';
import { useNavigate } from 'react-router-dom';

interface ShadowItem {
  id: string;
  cid: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter';
  metadata: string;
  deleted: boolean;
  encryptedKey?: number[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount, disconnect } = useWalletStore();
  const [decryptedItems, setDecryptedItems] = useState<Map<string, any>>(new Map());
  const [decrypting, setDecrypting] = useState<Set<string>>(new Set());
  const [glitchHeader, setGlitchHeader] = useState('SHADOW ARCHIVES');
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    // Occasional header glitch
    const interval = setInterval(() => {
      if (Math.random() > 0.9) {
        const chars = 'SHAD0W_ARCH1V3S_!@#';
        const glitched = 'SHADOW ARCHIVES'.split('').map(char => 
          Math.random() > 0.8 ? chars[Math.floor(Math.random() * chars.length)] : char
        ).join('');
        setGlitchHeader(glitched);
        setTimeout(() => setGlitchHeader('SHADOW ARCHIVES'), 150);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Check for consent record
  const { data: consentRecord } = useQuery({
    queryKey: ['consent-record', selectedAccount?.address],
    queryFn: async () => {
      if (!selectedAccount) return null;
      return await getConsentRecord(selectedAccount.address);
    },
    enabled: !!selectedAccount,
  });

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['shadow-items', selectedAccount?.address],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      try {
        // Try to get from chain first (will use mock data in mock mode)
        const chainItems = await getShadowItems(selectedAccount.address);
        console.log('Got shadow items:', chainItems);
        return chainItems as ShadowItem[];
      } catch (error) {
        console.error('Error fetching shadow items:', error);
        // Fallback to API if available
        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/shadow/items/${selectedAccount.address}`
          );
          return response.data.items as ShadowItem[];
        } catch {
          return [];
        }
      }
    },
    enabled: !!selectedAccount,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleAuthorize = async () => {
    if (!selectedAccount) return;

    setAuthorizing(true);
    try {
      // Create consent message
      const message = `Shadow Chain Consent: I authorize Shadow Chain to encrypt and store my public Web2 activity on-chain. Timestamp: ${Date.now()}`;
      const messageHash = '0x' + Buffer.from(message).toString('hex').substring(0, 64);
      
      // Grant consent on-chain
      await grantConsent(messageHash);
      
      toast.success('Authorization granted successfully!');
      setShowAuthorizeModal(false);
      
      // Trigger sync
      try {
        await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/sync/trigger`,
          { userAddress: selectedAccount.address }
        );
        toast.info('Sync triggered - your shadow items will appear soon');
      } catch (error) {
        console.error('Failed to trigger sync:', error);
      }
      
      // Refetch consent record
      refetch();
    } catch (error) {
      console.error('Authorization failed:', error);
      toast.error('Failed to grant authorization');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleDecrypt = async (item: ShadowItem) => {
    if (decrypting.has(item.id) || decryptedItems.has(item.id)) return;

    setDecrypting(prev => new Set(prev).add(item.id));

    try {
      // Simulate decryption process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockDecrypted = {
        source: item.source,
        url: item.source === 'GitHub' 
          ? 'https://github.com/user/repo/commit/abc123'
          : 'https://x.com/user/status/123456',
        body: item.source === 'GitHub'
          ? 'feat: Add encryption layer for Web2 shadow mirroring\n\n- Implemented XSalsa20-Poly1305 encryption\n- Added IPFS integration\n- Connected to Substrate pallet'
          : 'Just shipped Shadow Chain v1.0 🚀 Your Web2 activity, encrypted and owned by you. #Web3 #Privacy #Blockchain',
        timestamp: item.timestamp,
        author: selectedAccount?.meta.name || selectedAccount?.address.slice(0, 8) || 'Anonymous',
      };
      
      setDecryptedItems(prev => new Map(prev).set(item.id, mockDecrypted));
      toast.success('Content decrypted successfully');
    } catch (error) {
      console.error('Decryption failed:', error);
      toast.error('Failed to decrypt content');
    } finally {
      setDecrypting(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 1) return 'JUST NOW';
    if (hours < 24) return `${hours}H AGO`;
    if (hours < 168) return `${Math.floor(hours/24)}D AGO`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{ textAlign: 'center' }}>
          <div className="loading-dots" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p style={{ 
            fontFamily: 'var(--font-mono)', 
            color: 'var(--neon-violet)',
            fontSize: '0.875rem' 
          }}>
            LOADING SHADOW DATA...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ padding: '2rem' }}>
      {/* Header */}
      <header style={{ 
        marginBottom: '3rem',
        borderBottom: '1px solid var(--shadow-steel)',
        paddingBottom: '2rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 
              className="title-glitch" 
              data-text={glitchHeader}
              style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}
            >
              {glitchHeader}
            </h1>
            <p style={{ 
              fontFamily: 'var(--font-mono)', 
              color: 'var(--static-gray)',
              fontSize: '0.875rem'
            }}>
              ENCRYPTED MIRROR OF YOUR DIGITAL FOOTPRINT
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="wallet-badge" style={{ paddingLeft: '2rem' }}>
              <span style={{ color: 'var(--neon-cyan)' }}>
                {selectedAccount?.meta.name || selectedAccount?.address.slice(0, 6) + '...' + selectedAccount?.address.slice(-4)}
              </span>
            </div>
            <button 
              onClick={disconnect}
              className="btn-shadow"
              style={{ padding: '0.5rem 1rem' }}
            >
              <span>DISCONNECT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Authorization Banner */}
      {!consentRecord && (
        <div className="shadow-card" style={{
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, var(--shadow-carbon), var(--shadow-ink))',
          border: '2px solid var(--neon-violet)',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: 'var(--neon-violet)',
            marginBottom: '1rem',
            letterSpacing: '0.05em'
          }}>
            AUTHORIZATION REQUIRED
          </h3>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            color: 'var(--ghost-white)',
            marginBottom: '1.5rem',
            opacity: 0.8
          }}>
            Grant consent to start mirroring your Web2 activity on-chain
          </p>
          <button
            onClick={() => setShowAuthorizeModal(true)}
            className="btn-neon"
            style={{ padding: '0.75rem 2rem' }}
          >
            AUTHORIZE SYNC
          </button>
        </div>
      )}

      {/* Account Connections */}
      <section style={{ marginBottom: '3rem' }}>
        <AccountConnections />
      </section>

      {/* Shadow Items Grid */}
      <section>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '2rem',
          gap: '1rem'
        }}>
          <h2 style={{ 
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: 'var(--ghost-white)',
            letterSpacing: '0.05em'
          }}>
            SHADOW ITEMS
          </h2>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--neon-violet)',
            padding: '0.25rem 0.75rem',
            border: '1px solid var(--neon-violet)',
            borderRadius: 'var(--radius-sharp)'
          }}>
            {items?.length || 0} TOTAL
          </span>
        </div>

        {items && items.length > 0 ? (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {items.map((item) => (
              <div 
                key={item.id} 
                className="shadow-card data-row"
                style={{ 
                  padding: '1.5rem',
                  position: 'relative',
                  overflow: 'visible'
                }}
              >
                {/* Source indicator bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '4px',
                  height: '100%',
                  background: item.source === 'GitHub' 
                    ? 'var(--neon-violet)' 
                    : 'var(--neon-cyan)',
                  borderRadius: 'var(--radius-sharp) 0 0 var(--radius-sharp)'
                }} />

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '300px' }}>
                    {/* Header */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      marginBottom: '0.75rem'
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-tech)',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: item.source === 'GitHub' ? 'var(--neon-violet)' : 'var(--neon-cyan)',
                        letterSpacing: '0.1em'
                      }}>
                        [{item.source.toUpperCase()}]
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--static-gray)'
                      }}>
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>

                    {/* CID */}
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--corrupt-green)',
                      marginBottom: '1rem',
                      opacity: 0.8
                    }}>
                      CID://
                      <span className="text-corrupt" data-text={item.cid.substring(0, 24)}>
                        {item.cid.substring(0, 24)}...
                      </span>
                    </div>

                    {/* Decrypted content */}
                    {decryptedItems.has(item.id) && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'var(--shadow-void)',
                        border: '1px solid rgba(57, 255, 20, 0.3)',
                        borderRadius: 'var(--radius-sharp)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.813rem'
                      }}>
                        <div style={{ color: 'var(--corrupt-green)', marginBottom: '0.5rem' }}>
                          // DECRYPTED CONTENT
                        </div>
                        <div style={{ color: 'var(--ghost-white)', opacity: 0.9 }}>
                          {decryptedItems.get(item.id).body}
                        </div>
                        <div style={{ 
                          color: 'var(--static-gray)', 
                          fontSize: '0.75rem',
                          marginTop: '0.5rem'
                        }}>
                          <a 
                            href={decryptedItems.get(item.id).url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: 'var(--signal-blue)',
                              textDecoration: 'none',
                              borderBottom: '1px solid var(--signal-blue)'
                            }}
                          >
                            {decryptedItems.get(item.id).url}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Decrypt button */}
                  <button
                    onClick={() => handleDecrypt(item)}
                    disabled={decrypting.has(item.id) || decryptedItems.has(item.id)}
                    className={decryptedItems.has(item.id) ? 'btn-shadow' : 'btn-neon'}
                    style={{ 
                      padding: '0.5rem 1.5rem',
                      fontSize: '0.75rem',
                      opacity: decryptedItems.has(item.id) ? 0.5 : 1,
                      cursor: decryptedItems.has(item.id) ? 'default' : 'pointer'
                    }}
                  >
                    {decrypting.has(item.id) ? (
                      <div className="loading-dots" style={{ scale: '0.7' }}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : decryptedItems.has(item.id) ? (
                      'DECRYPTED'
                    ) : (
                      'DECRYPT'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="shadow-card" style={{
            textAlign: 'center',
            padding: '4rem 2rem'
          }}>
            <div style={{ 
              fontSize: '4rem',
              color: 'var(--shadow-steel)',
              marginBottom: '1rem'
            }}>
              ⬡
            </div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.125rem',
              color: 'var(--ghost-white)',
              marginBottom: '0.5rem',
              letterSpacing: '0.05em'
            }}>
              NO SHADOW ITEMS DETECTED
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--static-gray)'
            }}>
              {consentRecord ? 'Connect your accounts to start syncing' : 'Authorize syncing to begin'}
            </p>
          </div>
        )}
      </section>

      {/* Terminal status */}
      <div style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        padding: '0.75rem 1rem',
        background: 'var(--shadow-carbon)',
        border: '1px solid var(--shadow-steel)',
        borderRadius: 'var(--radius-sharp)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: 'var(--corrupt-green)',
        maxWidth: '300px'
      }}>
        <div>SYSTEM: <span style={{ color: 'var(--ghost-white)' }}>ONLINE</span></div>
        <div>CHAIN: <span style={{ color: 'var(--ghost-white)' }}>POLKADOT</span></div>
        <div>IPFS: <span style={{ color: 'var(--ghost-white)' }}>CONNECTED</span></div>
        <div>SYNC: <span style={{ color: consentRecord ? 'var(--corrupt-green)' : 'var(--warning-amber)' }}>
          {consentRecord ? 'AUTHORIZED' : 'PENDING'}
        </span></div>
      </div>

      {/* Authorization Modal */}
      {showAuthorizeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 9, 8, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="shadow-card" style={{
            maxWidth: '600px',
            padding: '3rem',
            border: '2px solid var(--neon-violet)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowAuthorizeModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--error-crimson)',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <h3 className="title-glitch" data-text="CONSENT PROTOCOL" style={{
              fontSize: '1.5rem',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              CONSENT PROTOCOL
            </h3>

            <div style={{
              background: 'var(--shadow-void)',
              border: '1px solid var(--shadow-steel)',
              borderRadius: 'var(--radius-sharp)',
              padding: '1.5rem',
              marginBottom: '2rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.813rem',
              lineHeight: 1.8
            }}>
              <div style={{ color: 'var(--corrupt-green)', marginBottom: '1rem' }}>
                // PRIVACY DECLARATION
              </div>
              <div style={{ color: 'var(--ghost-white)', opacity: 0.9 }}>
                By granting consent, you authorize Shadow Chain to:
                <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                  <li>• Access your PUBLIC GitHub repositories and commits</li>
                  <li>• Access your PUBLIC Twitter/X posts</li>
                  <li>• Encrypt all data with your keys before storage</li>
                  <li>• Store encrypted data on IPFS</li>
                  <li>• Record encrypted references on Polkadot</li>
                </ul>
                <div style={{ marginTop: '1rem', color: 'var(--warning-amber)' }}>
                  ⚠ Only YOU can decrypt your data with your private key
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowAuthorizeModal(false)}
                className="btn-shadow"
                style={{ padding: '0.75rem 2rem' }}
                disabled={authorizing}
              >
                <span>CANCEL</span>
              </button>
              <button
                onClick={handleAuthorize}
                className="btn-neon"
                style={{ padding: '0.75rem 2rem' }}
                disabled={authorizing}
              >
                {authorizing ? (
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  'GRANT CONSENT'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;