import React, { useState, useRef, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';

export default function AccountSwitcher() {
  const { selectedAccount, connectedAccounts, switchAccount } = useWalletStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!selectedAccount || connectedAccounts.length <= 1) {
    return null;
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-bg-elevated hover:bg-bg-tertiary border border-border-default hover:border-border-hover rounded-lg transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-semibold text-white">
          {selectedAccount.meta.name?.[0]?.toUpperCase() || '?'}
        </div>
        
        <div className="text-left">
          <div className="text-sm font-medium text-primary">
            {selectedAccount.meta.name || 'Unnamed Account'}
          </div>
          <div className="text-xs text-tertiary font-mono">
            {formatAddress(selectedAccount.address)}
          </div>
        </div>
        
        <svg
          className={`w-4 h-4 text-tertiary group-hover:text-secondary transition-all ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50 w-72 bg-bg-secondary border border-border-default rounded-lg shadow-xl overflow-hidden">
          <div className="p-3 bg-bg-elevated border-b border-border-default">
            <h3 className="text-sm font-medium text-secondary">Switch Account</h3>
            <p className="text-xs text-tertiary mt-1">
              {connectedAccounts.length} connected accounts
            </p>
          </div>
          
          <div className="py-2">
            {connectedAccounts.map((account) => {
              const isActive = account.address === selectedAccount.address;
              
              return (
                <button
                  key={account.address}
                  onClick={() => {
                    if (!isActive) {
                      switchAccount(account);
                      setIsOpen(false);
                    }
                  }}
                  disabled={isActive}
                  className={`w-full px-4 py-3 text-left hover:bg-bg-elevated transition-all flex items-center gap-3 ${
                    isActive ? 'opacity-60 cursor-not-allowed bg-bg-tertiary' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                    isActive 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                      : 'bg-bg-tertiary'
                  }`}>
                    {account.meta.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-medium text-primary">
                      {account.meta.name || 'Unnamed Account'}
                    </div>
                    <div className="text-xs text-tertiary font-mono">
                      {formatAddress(account.address)}
                    </div>
                  </div>
                  
                  {isActive && (
                    <span className="text-xs text-accent-success font-medium">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="p-3 bg-bg-elevated border-t border-border-default">
            <button
              onClick={() => {
                setIsOpen(false);
                // Optional: Add manage accounts functionality
              }}
              className="text-xs text-accent-primary hover:text-accent-secondary transition-colors font-medium"
            >
              Manage Accounts →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}