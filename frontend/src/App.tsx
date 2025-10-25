import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useWalletStore } from './store/wallet';
import Layout from './components/Layout';
import ConnectWallet from './pages/ConnectWallet';
import Dashboard from './pages/Dashboard';
import Authorize from './pages/Authorize';
import { setupPolkadotApi } from './services/polkadot';

function App() {
  const { isConnected, isInitialized, initializeWallet } = useWalletStore();

  useEffect(() => {
    // Initialize Polkadot API
    setupPolkadotApi().then(() => {
      initializeWallet();
    });
  }, [initializeWallet]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-polkadot-pink mx-auto"></div>
          <p className="mt-4 text-gray-400">Initializing Shadow Chain...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route 
          path="/" 
          element={
            isConnected ? <Navigate to="/dashboard" /> : <ConnectWallet />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isConnected ? <Dashboard /> : <Navigate to="/" />
          } 
        />
        <Route 
          path="/authorize" 
          element={
            isConnected ? <Authorize /> : <Navigate to="/" />
          } 
        />
      </Routes>
    </Layout>
  );
}

export default App;