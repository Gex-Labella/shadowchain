import React, { useState } from 'react';
import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { useWalletStore } from '../store/wallet';

export default function AccountSelector() {
  const { 
    availableAccounts, 
    isAccountSelectionOpen, 
    closeAccountSelection,
    connectAccounts 
  } = useWalletStore();
  
  const [selectedAccounts, setSelectedAccounts] = useState<InjectedAccountWithMeta[]>([]);

  if (!isAccountSelectionOpen) return null;

  const handleAccountToggle = (account: InjectedAccountWithMeta) => {
    setSelectedAccounts(prev => {
      const isSelected = prev.some(acc => acc.address === account.address);
      if (isSelected) {
        return prev.filter(acc => acc.address !== account.address);
      } else {
        return [...prev, account];
      }
    });
  };

  const handleConnect = () => {
    if (selectedAccounts.length === 0) {
      return;
    }
    connectAccounts(selectedAccounts);
    setSelectedAccounts([]);
  };

  const handleCancel = () => {
    closeAccountSelection();
    setSelectedAccounts([]);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              Select Accounts
            </h2>
            <p className="text-secondary text-sm">
              Choose which accounts to connect to Shadow Chain
            </p>
          </div>
          
          <button
            onClick={handleCancel}
            className="text-tertiary hover:text-primary transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {availableAccounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
              <svg className="w-8 h-8 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-secondary mb-2">No accounts found</p>
            <p className="text-tertiary text-sm">
              Please create an account in your Polkadot extension
            </p>
          </div>
        ) : (
          <>
            <div className="account-list">
              {availableAccounts.map((account) => (
                <div
                  key={account.address}
                  onClick={() => handleAccountToggle(account)}
                  className={`account-item ${
                    selectedAccounts.some(acc => acc.address === account.address) ? 'selected' : ''
                  }`}
                >
                  <div className={`checkbox ${
                    selectedAccounts.some(acc => acc.address === account.address) ? 'checked' : ''
                  }`} />
                  
                  <div className="flex-1">
                    <div className="font-medium">
                      {account.meta.name || 'Unnamed Account'}
                    </div>
                    <div className="text-tertiary text-sm font-mono">
                      {formatAddress(account.address)}
                    </div>
                  </div>
                  
                  {account.meta.source && (
                    <div className="badge text-xs">
                      {account.meta.source}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={selectedAccounts.length === 0}
                className={`btn ${
                  selectedAccounts.length === 0 ? 'btn-secondary opacity-50' : 'btn-primary'
                } flex-1`}
              >
                Connect {selectedAccounts.length > 0 && `(${selectedAccounts.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}