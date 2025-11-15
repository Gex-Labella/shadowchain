import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/shadowchain.css';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import OAuthCallback from './pages/OAuthCallback';
import { useWalletStore } from './store/wallet';
import { setupPolkadotApi } from './services/polkadot';

function App() {
  const { isConnected, initializeWallet } = useWalletStore();

  useEffect(() => {
    // Initialize wallet on app mount
    initializeWallet();
    // Initialize Polkadot API on app mount
    setupPolkadotApi().catch(console.error);
  }, [initializeWallet]);

  return (
    <div className="shadow-container">
      <Routes>
        <Route 
          path="/" 
          element={isConnected ? <Navigate to="/dashboard" /> : <Landing />} 
        />
        <Route 
          path="/dashboard" 
          element={isConnected ? <Dashboard /> : <Navigate to="/" />} 
        />
        <Route 
          path="/oauth/callback" 
          element={<OAuthCallback />} 
        />
      </Routes>
      
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}

export default App;