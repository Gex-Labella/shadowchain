import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { toast } from 'react-toastify';
import axios from 'axios';
import { AccountConnections } from '../components/AccountConnections';
import { RepositoryList } from '../components/RepositoryList';
import { BlockchainShadowItems } from '../components/BlockchainShadowItems';
import { IdentityCard } from '../components/IdentityCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { ChainVisualizer } from '../components/ChainVisualizer';
import AccountSwitcher from '../components/AccountSwitcher';
import { getShadowItems, getConsentRecord } from '../services/polkadot';
import {
  grantConsentWithUserSigning,
  fetchPendingTransactions,
  processAllPendingTransactions,
  submitShadowItemWithUserSigning
} from '../services/transactions';
import { useNavigate } from 'react-router-dom';

// Polyfill for Buffer in browser
const encodeToHex = (str: string): string => {
  return Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

interface ShadowItem {
  id: string;
  content: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter' | string;
  metadata: string;
  deleted: boolean;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount, disconnect } = useWalletStore();
  
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [signingProgress, setSigningProgress] = useState({ current: 0, total: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeView, setActiveView] = useState<'activity' | 'repositories' | 'chain' | 'connections'>('activity');

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
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const baseUrl = apiUrl.replace(/\/api\/?$/, '');
        const response = await axios.get(
          `${baseUrl}/api/shadow/items/${selectedAccount.address}`
        );
        
        if (response.data.items && response.data.items.length > 0) {
          return response.data.items as ShadowItem[];
        }
        
        const chainItems = await getShadowItems(selectedAccount.address);
        return chainItems as ShadowItem[];
      } catch (error) {
        console.error('Error fetching shadow items:', error);
        return [];
      }
    },
    enabled: !!selectedAccount,
    refetchInterval: 30000,
  });

  const handleAuthorize = async () => {
    if (!selectedAccount) return;

    setAuthorizing(true);
    try {
      const message = `Shadow Chain Consent: I authorize Shadow Chain to encrypt and store my public Web2 activity on-chain. Timestamp: ${Date.now()}`;
      const messageHash = '0x' + encodeToHex(message).substring(0, 64);
      
      await grantConsentWithUserSigning(messageHash);
      
      toast.success('Authorization granted successfully!');
      setShowAuthorizeModal(false);
      
      await handleSync();
      refetch();
    } catch (error) {
      console.error('Authorization failed:', error);
      toast.error('Failed to grant authorization');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccount) return;
    
    setIsSyncing(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const baseUrl = apiUrl.replace(/\/api\/?$/, '');
      
      try {
        const syncResponse = await axios.post(
          `${baseUrl}/api/transactions/sync-and-prepare/${selectedAccount.address}`
        );
        
        await refetch();
        
        if (syncResponse.data.transactions && syncResponse.data.transactions.length > 0) {
          setPendingTransactions(syncResponse.data.transactions);
          setShowTransactionModal(true);
          toast.success(`${syncResponse.data.transactions.length} new items ready to sign!`);
        } else {
          toast.info('Items synced and stored - check your shadow archives');
        }
      } catch (syncError: any) {
        console.error('Sync error:', syncError);
        if (syncError.response?.status === 400) {
          toast.error('Please connect your GitHub account first');
        } else {
          const transactions = await fetchPendingTransactions(selectedAccount.address);
          
          await refetch();
          
          if (transactions.length > 0) {
            setPendingTransactions(transactions);
            setShowTransactionModal(true);
          } else {
            toast.info('No new shadow items to sync');
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync:', error);
      toast.error('Failed to fetch shadow items');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignAllTransactions = async () => {
    if (!selectedAccount || pendingTransactions.length === 0) return;
    
    setShowTransactionModal(false);
    
    const result = await processAllPendingTransactions(
      selectedAccount.address,
      (current, total) => setSigningProgress({ current, total })
    );
    
    setSigningProgress({ current: 0, total: 0 });
    setPendingTransactions([]);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dark">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-gray-400 font-mono">Loading shadow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark bg-noise">
      <div className="dashboard-grid">
        {/* Sidebar Navigation */}
        <aside className="bg-glass-dark backdrop-blur-2xl border-r border-glass-light p-6 flex flex-col">
          <div className="mb-8">
            <h1 className="text-2xl font-display text-gradient mb-2">ShadowChain</h1>
            <p className="text-xs text-gray-400 font-mono">Web3 Identity Platform</p>
          </div>

          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveView('activity')}
              className={`nav-link w-full ${activeView === 'activity' ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Activity Feed</span>
            </button>

            <button
              onClick={() => setActiveView('repositories')}
              className={`nav-link w-full ${activeView === 'repositories' ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Repositories</span>
            </button>

            <button
              onClick={() => setActiveView('chain')}
              className={`nav-link w-full ${activeView === 'chain' ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Blockchain</span>
            </button>

            <button
              onClick={() => setActiveView('connections')}
              className={`nav-link w-full ${activeView === 'connections' ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span>Connections</span>
            </button>
          </nav>

          {/* Sync Button */}
          {consentRecord && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-neon w-full mt-6"
            >
              {isSyncing ? (
                <div className="loading-dots" style={{ justifyContent: 'center' }}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          )}

          {/* Account Switcher */}
          <div className="mt-6 pt-6 border-t border-glass-light">
            <AccountSwitcher />
            <button
              onClick={disconnect}
              className="btn-ghost w-full mt-3 text-sm"
            >
              Disconnect
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="p-8 overflow-y-auto">
          {/* Authorization Banner */}
          {!consentRecord && (
            <div className="glass-card mb-8 text-center border-2 border-dot-primary p-8 animate-slide-up">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-dot-primary/20 to-dot-accent/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-dot-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-display mb-3 text-white">Authorization Required</h3>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Grant consent to start mirroring your Web2 activity on-chain
              </p>
              <button
                onClick={() => setShowAuthorizeModal(true)}
                className="btn-neon"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Authorize Sync
              </button>
            </div>
          )}

          {/* Dynamic Content Based on Active View */}
          {activeView === 'activity' && <ActivityFeed />}
          {activeView === 'repositories' && <RepositoryList />}
          {activeView === 'chain' && <BlockchainShadowItems itemsPerPage={15} />}
          {activeView === 'connections' && <AccountConnections onConnectionChange={refetch} />}
        </main>

        {/* Right Panel */}
        <aside className="bg-glass-dark backdrop-blur-2xl border-l border-glass-light p-6 space-y-6 overflow-y-auto">
          <IdentityCard />
          <ChainVisualizer />
        </aside>
      </div>

      {/* Transaction Signing Modal */}
      {showTransactionModal && pendingTransactions.length > 0 && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-display mb-2 text-white">
                  Sign Transactions
                </h2>
                <p className="text-gray-400">
                  {pendingTransactions.length} shadow items ready to be submitted on-chain
                </p>
              </div>
              
              <button
                onClick={() => setShowTransactionModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-glass-white rounded-smooth p-4 mb-6 max-h-64 overflow-y-auto">
              {pendingTransactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-glass-light last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`badge ${
                      tx.source === 'github' ? 'badge-verified' : 'badge-pending'
                    }`}>
                      {tx.source?.toUpperCase() || 'UNKNOWN'}
                    </span>
                    <span className="text-gray-400 text-sm font-mono">
                      {new Date(tx.timestamp < 10000000000 ? tx.timestamp * 1000 : tx.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-trust-pending/10 border border-trust-pending/30 rounded-smooth p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-trust-pending flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-gray-300">
                  You will be asked to sign each transaction with your wallet
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTransactionModal(false)}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSignAllTransactions}
                className="btn-neon flex-1"
              >
                Sign All ({pendingTransactions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signing Progress */}
      {signingProgress.total > 0 && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md text-center p-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-dot-primary/20 to-dot-accent/20 flex items-center justify-center">
              <div className="loading-spinner" />
            </div>
            
            <h3 className="text-2xl font-display mb-3 text-white">Signing Transactions</h3>
            <p className="text-gray-400 mb-6">
              Please approve each transaction in your wallet
            </p>
            
            <div className="w-full h-2 bg-glass-dark rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-gradient-to-r from-dot-primary to-dot-accent transition-all duration-300 shadow-glow-sm"
                style={{ width: `${(signingProgress.current / signingProgress.total) * 100}%` }}
              />
            </div>
            
            <p className="text-sm font-mono text-gray-400">
              {signingProgress.current} / {signingProgress.total}
            </p>
          </div>
        </div>
      )}

      {/* Authorization Modal */}
      {showAuthorizeModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-display mb-2 text-white">
                  Consent Protocol
                </h2>
                <p className="text-gray-400">
                  Authorize Shadow Chain to mirror your digital footprint
                </p>
              </div>
              
              <button
                onClick={() => setShowAuthorizeModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-glass-white rounded-smooth p-6 mb-6">
              <h4 className="font-display mb-4 text-white">By granting consent, you authorize Shadow Chain to:</h4>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-trust-verified flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Access your PUBLIC GitHub repositories and commits</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-trust-verified flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Access your PUBLIC Twitter/X posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-trust-verified flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Store your Web2 activity data directly on Polkadot</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-trust-verified flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Make your digital footprint permanently accessible</span>
                </li>
              </ul>
              
              <div className="mt-6 p-4 bg-trust-pending/10 border border-trust-pending/30 rounded-smooth">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-trust-pending flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-gray-300">
                    Data will be publicly visible on the blockchain
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAuthorizeModal(false)}
                className="btn-ghost flex-1"
                disabled={authorizing}
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorize}
                className="btn-neon flex-1"
                disabled={authorizing}
              >
                {authorizing ? (
                  <div className="loading-spinner mx-auto" style={{ width: '1.5rem', height: '1.5rem' }} />
                ) : (
                  'Grant Consent'
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