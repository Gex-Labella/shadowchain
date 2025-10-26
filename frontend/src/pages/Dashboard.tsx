import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { toast } from 'react-toastify';
import axios from 'axios';
import { AccountConnections } from '../components/AccountConnections';

interface ShadowItem {
  id: string;
  cid: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter';
  metadata: string;
  deleted: boolean;
}

const Dashboard: React.FC = () => {
  const { selectedAccount } = useWalletStore();
  const [decryptedItems, setDecryptedItems] = useState<Map<string, any>>(new Map());
  const [decrypting, setDecrypting] = useState<Set<string>>(new Set());

  const { data: items, isLoading } = useQuery({
    queryKey: ['shadow-items', selectedAccount?.address],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/shadow/items/${selectedAccount.address}`
      );
      return response.data.items as ShadowItem[];
    },
    enabled: !!selectedAccount,
  });

  const handleDecrypt = async (item: ShadowItem) => {
    if (decrypting.has(item.id) || decryptedItems.has(item.id)) return;

    setDecrypting(prev => new Set(prev).add(item.id));

    try {
      // This is a simplified version - in production, you'd need to:
      // 1. Get the encrypted key from the chain
      // 2. Decrypt it with the user's private key
      // 3. Fetch the content from IPFS
      // 4. Decrypt the content
      
      toast.info('Decryption feature coming soon!');
      
      // Mock decrypted data for demo
      const mockDecrypted = {
        source: item.source,
        url: 'https://example.com',
        body: 'This is encrypted content that would be decrypted',
        timestamp: item.timestamp,
      };
      
      setDecryptedItems(prev => new Map(prev).set(item.id, mockDecrypted));
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSourceIcon = (source: string) => {
    if (source === 'GitHub') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-polkadot-pink"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Shadow Items</h1>
        <p className="text-gray-400">
          View and decrypt your mirrored Web2 activity
        </p>
      </div>

      {/* Account Connections Section */}
      <div className="mb-8">
        <AccountConnections />
      </div>

      {items && items.length > 0 ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-lg ${
                    item.source === 'GitHub' ? 'bg-gray-800' : 'bg-blue-900'
                  }`}>
                    {getSourceIcon(item.source)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">{item.source}</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(item.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 font-mono">
                      CID: {item.cid.substring(0, 16)}...
                    </div>
                    
                    {decryptedItems.has(item.id) && (
                      <div className="mt-4 p-4 bg-shadow-darker rounded-lg">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                          {JSON.stringify(decryptedItems.get(item.id), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => handleDecrypt(item)}
                  disabled={decrypting.has(item.id) || decryptedItems.has(item.id)}
                  className="btn-secondary text-sm"
                >
                  {decrypting.has(item.id) ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : decryptedItems.has(item.id) ? (
                    'Decrypted'
                  ) : (
                    'Decrypt'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-lg">No shadow items yet</p>
            <p className="text-sm mt-2">
              Authorize syncing to start mirroring your Web2 activity
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;