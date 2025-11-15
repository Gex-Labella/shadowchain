import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWalletStore } from '../store/wallet';

interface ShadowItem {
  id: string;
  content: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter' | string;
  metadata: string;
  deleted: boolean;
}

interface BlockchainShadowItemsProps {
  itemsPerPage?: number;
}

export const BlockchainShadowItems: React.FC<BlockchainShadowItemsProps> = ({ 
  itemsPerPage = 10 
}) => {
  const { selectedAccount } = useWalletStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterSource, setFilterSource] = useState<'all' | 'GitHub' | 'Twitter'>('all');

  // Fetch only blockchain items
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['blockchain-shadow-items', selectedAccount?.address, currentPage, itemsPerPage],
    queryFn: async () => {
      if (!selectedAccount) return null;
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      const res = await axios.get(
        `${baseUrl}/api/shadow/items/${selectedAccount.address}/blockchain`,
        {
          params: {
            page: currentPage,
            perPage: itemsPerPage
          }
        }
      );
      
      return res.data;
    },
    enabled: !!selectedAccount,
  });

  // Parse content from blockchain
  const parseContent = (item: ShadowItem) => {
    try {
      let content: any;
      
      if (item.content.startsWith('0x')) {
        const hexString = item.content.slice(2);
        const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const jsonStr = new TextDecoder().decode(bytes);
        content = JSON.parse(jsonStr);
      } else {
        content = JSON.parse(item.content);
      }
      
      let normalizedSource: string;
      if (typeof item.source === 'number') {
        normalizedSource = item.source === 0 ? 'GitHub' : 'Twitter';
      } else {
        const sourceStr = item.source?.toString().toLowerCase();
        normalizedSource = sourceStr === 'github' ? 'GitHub' :
                         sourceStr === 'twitter' ? 'Twitter' :
                         'Unknown';
      }
      
      let url = content.url || '';
      
      if (!url && item.metadata) {
        try {
          if (item.metadata.startsWith('0x')) {
            const hexString = item.metadata.slice(2);
            const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const jsonStr = new TextDecoder().decode(bytes);
            const metadata = JSON.parse(jsonStr);
            url = metadata.url || '';
          }
        } catch (e) {
          console.error('Failed to parse metadata:', e);
        }
      }

      return {
        source: normalizedSource,
        url,
        body: content.body || `${normalizedSource} content`,
        timestamp: content.timestamp < 10000000000
          ? content.timestamp * 1000
          : content.timestamp,
        author: content.raw_meta?.author || content.author || 'Unknown',
      };
    } catch (error) {
      console.error('Failed to parse content:', error);
      return null;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSourceColor = (source: string | number | undefined) => {
    if (typeof source === 'number') {
      return source === 0 ? 'var(--neon-violet)' : 'var(--neon-cyan)';
    }
    const normalizedSource = source?.toString().toLowerCase();
    return normalizedSource === 'github' ? 'var(--neon-violet)' : 'var(--neon-cyan)';
  };

  // Filter items by source
  const filteredItems = response?.items?.filter((item: ShadowItem) => {
    if (filterSource === 'all') return true;
    const content = parseContent(item);
    return content?.source === filterSource;
  }) || [];

  const totalPages = response?.totalPages || 1;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="loading-dots" style={{ justifyContent: 'center' }}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--neon-violet)',
          fontSize: '0.875rem',
          marginTop: '1rem'
        }}>
          LOADING BLOCKCHAIN DATA...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shadow-card" style={{
        textAlign: 'center',
        padding: '2rem',
        border: '1px solid var(--error-crimson)'
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--error-crimson)'
        }}>
          Failed to load blockchain data
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            color: 'var(--ghost-white)',
            letterSpacing: '0.05em'
          }}>
            ON-CHAIN SHADOW ITEMS
          </h2>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--corrupt-green)',
            padding: '0.25rem 0.75rem',
            border: '1px solid var(--corrupt-green)',
            borderRadius: 'var(--radius-sharp)'
          }}>
            {response?.total || 0} CONFIRMED
          </span>
        </div>

        {/* Source filter */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.813rem'
        }}>
          <button
            onClick={() => setFilterSource('all')}
            className={filterSource === 'all' ? 'btn-neon' : 'btn-shadow'}
            style={{ padding: '0.375rem 0.75rem' }}
          >
            ALL
          </button>
          <button
            onClick={() => setFilterSource('GitHub')}
            className={filterSource === 'GitHub' ? 'btn-neon' : 'btn-shadow'}
            style={{ 
              padding: '0.375rem 0.75rem',
              borderColor: 'var(--neon-violet)',
              color: filterSource === 'GitHub' ? 'var(--shadow-ink)' : 'var(--neon-violet)'
            }}
          >
            GITHUB
          </button>
          <button
            onClick={() => setFilterSource('Twitter')}
            className={filterSource === 'Twitter' ? 'btn-neon' : 'btn-shadow'}
            style={{ 
              padding: '0.375rem 0.75rem',
              borderColor: 'var(--neon-cyan)',
              color: filterSource === 'Twitter' ? 'var(--shadow-ink)' : 'var(--neon-cyan)'
            }}
          >
            TWITTER
          </button>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredItems.map((item: ShadowItem) => (
              <div 
                key={item.id} 
                className="shadow-card"
                style={{ 
                  padding: '1.5rem',
                  position: 'relative',
                  borderLeft: `4px solid ${getSourceColor(item.source)}`
                }}
              >
                {/* Content */}
                {(() => {
                  const content = parseContent(item);
                  if (!content) return null;
                  
                  return (
                    <>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                        gap: '1rem'
                      }}>
                        <div>
                          <span style={{
                            fontFamily: 'var(--font-tech)',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: getSourceColor(item.source),
                            letterSpacing: '0.1em'
                          }}>
                            [{content.source.toUpperCase()}]
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            color: 'var(--static-gray)',
                            marginLeft: '1rem'
                          }}>
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                        
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.688rem',
                          color: 'var(--corrupt-green)',
                          padding: '0.25rem 0.5rem',
                          border: '1px solid var(--corrupt-green)',
                          borderRadius: 'var(--radius-sharp)'
                        }}>
                          CONFIRMED
                        </div>
                      </div>

                      <div style={{
                        background: 'var(--shadow-void)',
                        border: '1px solid rgba(57, 255, 20, 0.3)',
                        borderRadius: 'var(--radius-sharp)',
                        padding: '1rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.813rem'
                      }}>
                        <div style={{ color: 'var(--ghost-white)', opacity: 0.9, whiteSpace: 'pre-wrap' }}>
                          {content.body}
                        </div>
                        {content.author && (
                          <div style={{
                            color: 'var(--static-gray)',
                            fontSize: '0.75rem',
                            marginTop: '0.5rem'
                          }}>
                            by {content.author}
                          </div>
                        )}
                      </div>

                      {content.url && (
                        <div style={{
                          marginTop: '1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <a
                            href={content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              color: 'var(--signal-blue)',
                              textDecoration: 'none',
                              borderBottom: '1px solid var(--signal-blue)',
                              display: 'inline-block',
                              maxWidth: '400px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {content.url}
                          </a>
                          
                          <button
                            onClick={() => window.open(`https://polkadot.js.org/apps/?rpc=wss://rococo-rpc.polkadot.io#/explorer`, '_blank')}
                            className="btn-shadow"
                            style={{
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.688rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            VIEW TX
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '2rem'
            }}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn-shadow"
                style={{
                  padding: '0.5rem 1rem',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                ← PREV
              </button>
              
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--ghost-white)'
              }}>
                PAGE {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn-shadow"
                style={{
                  padding: '0.5rem 1rem',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                NEXT →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="shadow-card" style={{
          textAlign: 'center',
          padding: '3rem'
        }}>
          <div style={{ 
            fontSize: '3rem',
            color: 'var(--shadow-steel)',
            marginBottom: '1rem'
          }}>
            ⬢
          </div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            color: 'var(--ghost-white)',
            marginBottom: '0.5rem'
          }}>
            NO ON-CHAIN ITEMS
          </p>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.813rem',
            color: 'var(--static-gray)'
          }}>
            Submit shadow items to see them here
          </p>
        </div>
      )}
    </div>
  );
};