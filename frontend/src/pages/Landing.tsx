import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useWalletStore } from '../store/wallet';

const Landing: React.FC = () => {
  const { connect, accounts, selectAccount } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [glitchText, setGlitchText] = useState('SHADOW CHAIN');

  useEffect(() => {
    // Occasional glitch effect
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        const chars = 'SHAD0W_CHA1N_!@#$%';
        const glitched = 'SHADOW CHAIN'.split('').map(char => 
          Math.random() > 0.7 ? chars[Math.floor(Math.random() * chars.length)] : char
        ).join('');
        setGlitchText(glitched);
        setTimeout(() => setGlitchText('SHADOW CHAIN'), 100);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    
    try {
      await connect();
      
      // After connect, if there are accounts and only one, it auto-selects
      // If multiple accounts, user needs to select from the list
      if (accounts.length > 1) {
        // In a real app, you'd show an account selector modal here
        // For now, just select the first one
        await selectAccount(accounts[0]);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Animated background grid */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(157, 78, 221, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 245, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'slide 20s linear infinite',
        }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <h1 
          className="title-glitch mb-4" 
          data-text={glitchText}
          style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}
        >
          {glitchText}
        </h1>
        
        <p className="text-corrupt mb-2" data-text="MIRROR YOUR DIGITAL SHADOW">
          <span style={{ 
            fontFamily: 'var(--font-tech)', 
            fontSize: '1.5rem',
            color: 'var(--ghost-white)',
            letterSpacing: '0.2em'
          }}>
            MIRROR YOUR DIGITAL SHADOW
          </span>
        </p>

        <p style={{ 
          fontFamily: 'var(--font-mono)', 
          color: 'var(--static-gray)',
          fontSize: '0.875rem',
          lineHeight: '1.8',
          maxWidth: '600px',
          margin: '2rem auto 3rem'
        }}>
          Your Web2 activity • Encrypted on IPFS • Secured by Polkadot
          <br />
          <span style={{ color: 'var(--neon-cyan)', opacity: 0.8 }}>
            [ GitHub commits × Twitter posts → Private blockchain ]
          </span>
        </p>

        {/* Connection button */}
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="btn-neon"
          style={{
            padding: '1rem 3rem',
            fontSize: '1rem',
            marginBottom: '2rem'
          }}
        >
          {isConnecting ? (
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : (
            'CONNECT WALLET'
          )}
        </button>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="shadow-card">
            <div style={{ 
              color: 'var(--neon-violet)', 
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              ◢◤
            </div>
            <h3 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              letterSpacing: '0.1em',
              marginBottom: '0.5rem'
            }}>
              ENCRYPTED
            </h3>
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--static-gray)' 
            }}>
              Military-grade encryption
              <br />
              Your keys, your data
            </p>
          </div>

          <div className="shadow-card">
            <div style={{ 
              color: 'var(--neon-cyan)', 
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              ⟠
            </div>
            <h3 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              letterSpacing: '0.1em',
              marginBottom: '0.5rem'
            }}>
              DISTRIBUTED
            </h3>
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--static-gray)' 
            }}>
              IPFS persistence
              <br />
              Censorship resistant
            </p>
          </div>

          <div className="shadow-card">
            <div style={{ 
              color: 'var(--corrupt-green)', 
              fontSize: '2rem',
              marginBottom: '0.5rem'
            }}>
              ⬡
            </div>
            <h3 style={{ 
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              letterSpacing: '0.1em',
              marginBottom: '0.5rem'
            }}>
              SOVEREIGN
            </h3>
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--static-gray)' 
            }}>
              Your chain, your rules
              <br />
              Complete ownership
            </p>
          </div>
        </div>

        {/* Terminal-style footer */}
        <div style={{
          marginTop: '4rem',
          padding: '1rem',
          background: 'var(--shadow-void)',
          border: '1px solid var(--shadow-steel)',
          borderRadius: 'var(--radius-sharp)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--corrupt-green)',
          textAlign: 'left'
        }}>
          <span style={{ color: 'var(--static-gray)' }}>$</span> shadowchain --version
          <br />
          <span style={{ color: 'var(--ghost-white)', opacity: 0.7 }}>
            v1.0.0-noir [substrate/polkadot] [ipfs/libsodium]
          </span>
          <br />
          <span style={{ color: 'var(--static-gray)' }}>$</span> status: 
          <span style={{ color: isConnecting ? 'var(--warning-amber)' : 'var(--corrupt-green)' }}>
            {' '}{isConnecting ? 'CONNECTING...' : 'READY'}
          </span>
          <span 
            style={{
              animation: 'blink 1s infinite',
              marginLeft: '2px'
            }}
          >_</span>
        </div>
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Landing;