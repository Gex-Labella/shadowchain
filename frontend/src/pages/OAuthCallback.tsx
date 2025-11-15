import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useWalletStore } from '../store/wallet';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedAccount } = useWalletStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('PROCESSING AUTHORIZATION...');

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error first
      const error = searchParams.get('error');
      if (error) {
        setStatus('error');
        setMessage(`AUTHORIZATION FAILED: ${error.toUpperCase()}`);
        toast.error('Authorization failed');
        setTimeout(() => navigate('/dashboard'), 3000);
        return;
      }

      // Check if this is a successful redirect from backend
      const success = searchParams.get('success');
      const service = searchParams.get('service');
      const username = searchParams.get('username');

      if (success === 'true' && service && username) {
        // Backend already processed the OAuth flow successfully
        setStatus('success');
        setMessage(`${service.toUpperCase()} CONNECTED SUCCESSFULLY`);
        toast.success(`${service} account @${username} connected!`);
        setTimeout(() => navigate('/dashboard'), 2000);
        return;
      }

      // If we get here, something went wrong
      const callbackError = searchParams.get('error');
      if (callbackError) {
        setStatus('error');
        setMessage(`AUTHORIZATION FAILED: ${callbackError.toUpperCase()}`);
        toast.error('Authorization failed');
      } else {
        setStatus('error');
        setMessage('INVALID CALLBACK PARAMETERS');
        toast.error('Invalid callback parameters');
      }
      setTimeout(() => navigate('/dashboard'), 3000);
    };

    handleCallback();
  }, [searchParams, navigate, selectedAccount]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      {/* Matrix rain effect background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse at center, rgba(0, 245, 255, 0.1) 0%, transparent 70%),
            var(--shadow-void)
          `,
        }} />
        {/* Animated vertical lines */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '-100%',
              left: `${i * 5}%`,
              width: '1px',
              height: '200%',
              background: `linear-gradient(transparent, var(--corrupt-green), transparent)`,
              opacity: Math.random() * 0.5,
              animation: `matrix-fall ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        <div className="shadow-card" style={{
          maxWidth: '500px',
          margin: '0 auto',
          padding: '3rem',
          border: status === 'error' ? '2px solid var(--error-crimson)' : 
                   status === 'success' ? '2px solid var(--corrupt-green)' :
                   '2px solid var(--neon-violet)',
        }}>
          {/* Status icon */}
          <div style={{
            fontSize: '4rem',
            marginBottom: '2rem',
            color: status === 'error' ? 'var(--error-crimson)' : 
                   status === 'success' ? 'var(--corrupt-green)' :
                   'var(--neon-violet)',
            animation: status === 'processing' ? 'pulse-glow 1s ease-in-out infinite' : 'none',
          }}>
            {status === 'processing' && '⟳'}
            {status === 'success' && '✓'}
            {status === 'error' && '✗'}
          </div>

          {/* Status message */}
          <h2 className="title-glitch" 
              data-text={message}
              style={{ 
                fontSize: '1.5rem',
                marginBottom: '1rem',
                color: status === 'error' ? 'var(--error-crimson)' : 
                       status === 'success' ? 'var(--corrupt-green)' :
                       'var(--ghost-white)',
              }}>
            {message}
          </h2>

          {/* Progress indicator */}
          {status === 'processing' && (
            <div className="loading-dots" style={{ justifyContent: 'center', marginTop: '2rem' }}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          {/* Terminal output */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: 'var(--shadow-void)',
            border: '1px solid var(--shadow-steel)',
            borderRadius: 'var(--radius-sharp)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            textAlign: 'left',
            color: 'var(--corrupt-green)',
          }}>
            <div>$ oauth --callback</div>
            <div style={{ color: 'var(--static-gray)' }}>
              {status === 'processing' && '> Exchanging authorization code...'}
              {status === 'success' && '> Token stored successfully'}
              {status === 'error' && '> Authorization failed'}
            </div>
            <div style={{ color: 'var(--ghost-white)', opacity: 0.7 }}>
              {status === 'processing' && '> Validating credentials...'}
              {status === 'success' && '> GitHub account linked'}
              {status === 'error' && '> Redirecting to dashboard...'}
            </div>
            <span 
              style={{
                animation: 'blink 1s infinite',
                marginLeft: '2px'
              }}
            >_</span>
          </div>

          {/* Redirect message */}
          <p style={{
            marginTop: '2rem',
            fontSize: '0.875rem',
            color: 'var(--static-gray)',
            fontFamily: 'var(--font-mono)',
          }}>
            {status !== 'processing' && 'REDIRECTING TO DASHBOARD...'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes matrix-fall {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        @keyframes pulse-glow {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.7; 
            transform: scale(1.1);
          }
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default OAuthCallback;