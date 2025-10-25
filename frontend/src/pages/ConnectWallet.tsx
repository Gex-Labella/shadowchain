import React, { useState } from 'react';
import { useWalletStore } from '../store/wallet';
import { toast } from 'react-toastify';

const ConnectWallet: React.FC = () => {
  const { connect, accounts, selectAccount } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
      if (accounts.length > 0) {
        setShowAccounts(true);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectAccount = async (account: any) => {
    try {
      await selectAccount(account);
    } catch (error) {
      console.error('Failed to select account:', error);
      toast.error('Failed to select account');
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold gradient-text mb-4">
            Welcome to Shadow Chain
          </h2>
          <p className="text-gray-400">
            Mirror your Web2 activity on a private blockchain
          </p>
        </div>

        {!showAccounts ? (
          <div className="card text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-polkadot-pink to-substrate-green p-1">
                <div className="w-full h-full rounded-full bg-shadow-dark flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400 text-sm">
                Connect your Polkadot.js wallet to get started
              </p>
            </div>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                'Connect Polkadot.js'
              )}
            </button>

            <div className="mt-6 text-sm text-gray-500">
              <p>Don't have Polkadot.js extension?</p>
              <a
                href="https://polkadot.js.org/extension/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-polkadot-pink hover:underline"
              >
                Install it here →
              </a>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Select Account</h3>
            <div className="space-y-2">
              {accounts.map((account) => (
                <button
                  key={account.address}
                  onClick={() => handleSelectAccount(account)}
                  className="w-full p-4 border border-gray-700 rounded-lg hover:border-polkadot-pink transition-colors text-left"
                >
                  <div className="font-medium">
                    {account.meta.name || 'Account'}
                  </div>
                  <div className="text-sm text-gray-400 font-mono mt-1">
                    {account.address}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your keys • Your data • Your blockchain</p>
        </div>
      </div>
    </div>
  );
};

export default ConnectWallet;