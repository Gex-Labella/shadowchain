import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import WalletInfo from './WalletInfo';
import { useWalletStore } from '../store/wallet';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { isConnected } = useWalletStore();

  return (
    <div className="min-h-screen bg-shadow-darker">
      <nav className="bg-shadow-dark border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <h1 className="text-2xl font-bold gradient-text">Shadow Chain</h1>
              </Link>
              {isConnected && (
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link
                    to="/dashboard"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname === '/dashboard'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/authorize"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      location.pathname === '/authorize'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    Authorize
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center">
              <WalletInfo />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-shadow-dark border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>Shadow Chain - Your Web2 activity, secured on Web3</p>
            <p className="mt-2">
              Powered by{' '}
              <span className="text-polkadot-pink">Polkadot</span> &{' '}
              <span className="text-substrate-green">Substrate</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;