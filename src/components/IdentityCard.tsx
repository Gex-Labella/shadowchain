import React, { useMemo } from 'react';
import { useWalletStore } from '../store/wallet';

interface IdentityCardProps {
  compact?: boolean;
}

export const IdentityCard: React.FC<IdentityCardProps> = ({ compact = false }) => {
  const { selectedAccount, connectedAccounts } = useWalletStore();

  // Generate a deterministic avatar based on address
  const avatarGradient = useMemo(() => {
    if (!selectedAccount) return 'from-dot-primary to-dot-accent';
    
    const colors = [
      'from-dot-primary to-shadow-300',
      'from-shadow-200 to-dot-accent',
      'from-source-github to-source-twitter',
      'from-trust-encrypted to-shadow-400',
      'from-dot-accent to-trust-verified',
    ];
    
    const index = parseInt(selectedAccount.address.slice(-2), 16) % colors.length;
    return colors[index];
  }, [selectedAccount]);

  // Calculate reputation score (mock for now)
  const reputationScore = useMemo(() => {
    // In a real app, this would calculate based on on-chain activity
    return 92;
  }, []);

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!selectedAccount) {
    return (
      <div className="bg-glass-dark backdrop-blur-xl border border-glass-light rounded-smooth p-6">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-shadow-100 to-shadow-200 animate-pulse" />
          <p className="text-gray-400 font-body">No wallet connected</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-glass-dark backdrop-blur-xl rounded-smooth border border-glass-light hover:border-dot-primary transition-colors duration-300">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient} shadow-glow-sm`} />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white truncate">
            {formatAddress(selectedAccount.address)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-trust-verified">● Active</span>
            <span className="text-2xs text-gray-400">Score: {reputationScore}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-glass-dark backdrop-blur-2xl border border-glass-light rounded-smooth p-6 shadow-glass">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <h3 className="font-display text-lg text-white/90">Identity</h3>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-trust-verified animate-pulse" />
          <span className="text-xs text-trust-verified font-mono">ACTIVE</span>
        </div>
      </div>

      {/* Avatar & Address */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-4">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarGradient} shadow-glow animate-float`} />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-shadow-50 rounded-full border-2 border-dot-primary flex items-center justify-center">
            <span className="text-xs font-bold text-white">{connectedAccounts.length}</span>
          </div>
        </div>
        
        <div className="text-center">
          <p className="font-mono text-sm text-white/80 mb-1">
            {formatAddress(selectedAccount.address)}
          </p>
          {selectedAccount.meta?.name && (
            <p className="text-xs text-gray-400 font-body">{selectedAccount.meta.name}</p>
          )}
        </div>
      </div>

      {/* Reputation Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-body">Reputation Score</span>
          <span className="text-2xl font-display text-dot-primary">{reputationScore}</span>
        </div>
        <div className="w-full h-2 bg-glass-dark rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-dot-primary to-dot-accent rounded-full transition-all duration-500 shadow-glow-sm"
            style={{ width: `${reputationScore}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-glass-white rounded-sharp p-3 text-center">
          <p className="text-2xs text-gray-400 mb-1">Items</p>
          <p className="text-lg font-display text-white">1.2K</p>
        </div>
        <div className="bg-glass-white rounded-sharp p-3 text-center">
          <p className="text-2xs text-gray-400 mb-1">Storage</p>
          <p className="text-lg font-display text-white">24MB</p>
        </div>
        <div className="bg-glass-white rounded-sharp p-3 text-center">
          <p className="text-2xs text-gray-400 mb-1">Accounts</p>
          <p className="text-lg font-display text-white">{connectedAccounts.length}</p>
        </div>
      </div>

      {/* Privacy Toggle */}
      <div className="mt-6 pt-6 border-t border-glass-light">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-trust-encrypted/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-trust-encrypted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-body text-white">Privacy Mode</p>
              <p className="text-2xs text-gray-400">All data encrypted</p>
            </div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-trust-encrypted transition-colors">
            <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};