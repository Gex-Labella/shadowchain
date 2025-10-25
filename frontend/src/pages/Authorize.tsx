import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/wallet';
import { grantConsent } from '../services/polkadot';
import { toast } from 'react-toastify';

const Authorize: React.FC = () => {
  const navigate = useNavigate();
  const { selectedAccount } = useWalletStore();
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAuthorize = async () => {
    if (!selectedAccount || !accepted) return;

    setIsAuthorizing(true);
    try {
      // Create consent message
      const consentMessage = `Shadow Chain Consent\n\nI authorize Shadow Chain to:\n- Read my public GitHub commits\n- Read my public Twitter posts\n- Encrypt and store this data on my private blockchain\n- Keep all data encrypted with my keys\n\nAccount: ${selectedAccount.address}\nDate: ${new Date().toISOString()}`;
      
      // Hash the message
      const encoder = new TextEncoder();
      const data = encoder.encode(consentMessage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Grant consent on-chain (expires in 1 year)
      const oneYearInSeconds = 365 * 24 * 60 * 60;
      await grantConsent(hashHex, oneYearInSeconds);

      toast.success('Authorization granted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Authorization failed:', error);
      toast.error('Failed to grant authorization');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Authorize Shadow Chain</h1>
        <p className="text-gray-400">
          Grant permission to sync your Web2 activity
        </p>
      </div>

      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Privacy Notice</h2>
        
        <div className="space-y-4 text-gray-300">
          <div>
            <h3 className="font-medium text-white mb-2">What Shadow Chain will access:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Your public GitHub commits from configured repositories</li>
              <li>Your public tweets and replies</li>
              <li>Basic metadata (timestamps, URLs)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">How your data is protected:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All content is encrypted with your unique keys</li>
              <li>Only you can decrypt your data</li>
              <li>Encrypted data is stored on IPFS</li>
              <li>References are stored on your private blockchain</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Your rights:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Revoke access at any time</li>
              <li>Delete your shadow items</li>
              <li>Export your encrypted data</li>
              <li>Full control over your blockchain</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-shadow-darker rounded-lg">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 rounded border-gray-600 text-polkadot-pink focus:ring-polkadot-pink"
            />
            <span className="text-sm">
              I understand and accept that Shadow Chain will access my public Web2 data
              and store it encrypted on my private blockchain. I can revoke this
              authorization at any time.
            </span>
          </label>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleAuthorize}
          disabled={!accepted || isAuthorizing}
          className={`btn-primary flex-1 flex items-center justify-center ${
            !accepted ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isAuthorizing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Authorizing...
            </>
          ) : (
            'Grant Authorization'
          )}
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>

      <div className="mt-12 p-6 bg-yellow-900/20 border border-yellow-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <svg
            className="w-6 h-6 text-yellow-500 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm">
            <p className="font-medium text-yellow-500 mb-1">Important Note</p>
            <p className="text-gray-300">
              Shadow Chain runs a background service that periodically fetches your
              Web2 activity. This service only accesses public data and all content
              is encrypted before storage. You maintain full control and can stop
              syncing at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Authorize;