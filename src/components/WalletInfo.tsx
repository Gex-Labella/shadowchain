import React from 'react';
import { useWalletStore } from '../store/wallet';
import Identicon from '@polkadot/react-identicon';

const WalletInfo: React.FC = () => {
  const { isConnected, selectedAccount, disconnect } = useWalletStore();

  if (!isConnected || !selectedAccount) {
    return null;
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2 bg-gray-800 rounded-lg px-3 py-2">
        <Identicon
          value={selectedAccount.address}
          size={24}
          theme="polkadot"
        />
        <div className="text-sm">
          <div className="text-gray-300 font-medium">
            {selectedAccount.meta.name || 'Account'}
          </div>
          <div className="text-gray-500 text-xs font-mono">
            {truncateAddress(selectedAccount.address)}
          </div>
        </div>
      </div>
      <button
        onClick={disconnect}
        className="btn-secondary text-sm"
      >
        Disconnect
      </button>
    </div>
  );
};

export default WalletInfo;