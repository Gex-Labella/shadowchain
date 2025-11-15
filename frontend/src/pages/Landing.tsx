import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/wallet';
import AccountSelector from '../components/AccountSelector';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { connectedAccounts, openAccountSelection } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // If user already has connected accounts, redirect to dashboard
    if (connectedAccounts.length > 0) {
      navigate('/dashboard');
    }
  }, [connectedAccounts, navigate]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await openAccountSelection();
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <AccountSelector />
      <div className="min-h-screen relative overflow-hidden">
        {/* Subtle background effects */}
        <div className="hero-glow" style={{ top: '-20%', left: '-10%' }} />
        <div className="hero-glow" style={{ bottom: '-30%', right: '-15%', background: 'radial-gradient(circle, var(--accent-secondary), transparent)' }} />
        
        {/* Navigation */}
        <nav className="relative z-10 py-6">
          <div className="container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <span className="text-lg font-semibold">Shadow Chain</span>
              </div>
              
              <div className="flex items-center gap-4">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <a href="https://github.com/tufstraka/shadowchain/docs" className="text-secondary hover:text-primary transition-colors text-sm font-medium">
                  Docs
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative z-10 py-20">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Your Digital Shadow,
                <br />
                <span className="gradient-text">On-Chain Forever</span>
              </h1>
              
              <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto">
                Mirror your Web2 activity on a sovereign blockchain. Connect GitHub, Twitter, and more to create an immutable record of your digital footprint.
              </p>

              {/* Connect Wallet CTA */}
              <div className="glass-card max-w-md mx-auto">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">Start Your Journey</h3>
                  <p className="text-secondary text-sm mb-6">
                    Connect your Polkadot wallet to begin archiving your digital legacy
                  </p>
                  
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="btn btn-primary w-full"
                  >
                    {isConnecting ? (
                      <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Connect Polkadot Wallet
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-tertiary mt-4">
                    No wallet? 
                    <a href="https://polkadot.js.org/extension/" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline ml-1">
                      Get Polkadot.js
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative z-10 py-20">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">
              Built for the <span className="gradient-text">Future</span>
            </h2>
            
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Fully Encrypted</h3>
                <p className="text-secondary">
                  Your data is encrypted before storage. Only you can decrypt and view your content.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Distributed Storage</h3>
                <p className="text-secondary">
                  Leveraging IPFS and Polkadot for censorship-resistant, permanent storage.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">True Ownership</h3>
                <p className="text-secondary">
                  Your keys, your data. No intermediaries, no gatekeepers, just you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="relative z-10 py-20">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">
                How It <span className="gradient-text">Works</span>
              </h2>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Connect Your Wallet</h3>
                    <p className="text-secondary">Link your Polkadot wallet to establish your on-chain identity</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Authorize Platforms</h3>
                    <p className="text-secondary">Connect your GitHub, Twitter, and other Web2 accounts</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Automatic Archiving</h3>
                    <p className="text-secondary">Your activity is encrypted and stored on-chain automatically</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Access Forever</h3>
                    <p className="text-secondary">View and verify your digital shadow anytime, forever</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 py-8 border-t border-border-default">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <span className="text-sm text-tertiary">© 2025 Shadow Chain</span>
                <a href="/privacy" className="text-sm text-tertiary hover:text-primary transition-colors">
                  Privacy
                </a>
                <a href="/terms" className="text-sm text-tertiary hover:text-primary transition-colors">
                  Terms
                </a>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-tertiary">Powered by</span>
                <svg className="w-20 h-6" viewBox="0 0 80 24" fill="none">
                  <circle cx="12" cy="12" r="11" stroke="var(--accent-primary)" strokeWidth="2"/>
                  <circle cx="40" cy="12" r="11" stroke="var(--accent-secondary)" strokeWidth="2"/>
                  <circle cx="68" cy="12" r="11" stroke="var(--accent-primary)" strokeWidth="2"/>
                </svg>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;