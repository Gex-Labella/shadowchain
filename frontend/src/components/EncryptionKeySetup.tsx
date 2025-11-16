import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/wallet';
import { cryptoService } from '../services/crypto';
import axios from 'axios';
import { toast } from 'react-toastify';
import { config } from '../config/environment';

interface EncryptionKeySetupProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const EncryptionKeySetup: React.FC<EncryptionKeySetupProps> = ({ 
  onComplete, 
  onSkip 
}) => {
  const { selectedAccount } = useWalletStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'intro' | 'password' | 'generating' | 'complete'>('intro');

  useEffect(() => {
    // Check if user already has an encryption key
    const checkExistingKey = async () => {
      if (cryptoService.hasStoredKeyPair()) {
        setHasExistingKey(true);
      }
    };
    checkExistingKey();
  }, []);

  const handleGenerateKey = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (!selectedAccount) {
      toast.error('No wallet connected');
      return;
    }

    setIsGenerating(true);
    setStep('generating');

    try {
      // Generate new keypair
      const keyPair = await cryptoService.generateKeyPair();
      
      // Store keypair with password
      await cryptoService.storeKeyPair(keyPair, password);
      
      // Create ownership message
      const message = cryptoService.createKeyOwnershipMessage(
        selectedAccount.address,
        keyPair.publicKey
      );
      
      // Sign the message with Polkadot account
      const { injector } = useWalletStore.getState();
      if (!injector || !injector.signer.signRaw) {
        throw new Error('Wallet does not support message signing');
      }
      
      const { signature } = await injector.signer.signRaw({
        address: selectedAccount.address,
        data: message,
        type: 'bytes'
      });

      // Register the key with the backend
      const apiUrl = config.api.baseUrl;
      await axios.post(`${apiUrl}/auth/register-encryption-key`, {
        userAddress: selectedAccount.address,
        publicKey: keyPair.publicKey,
        signedMessage: signature
      });

      toast.success('Encryption key created and registered!');
      setStep('complete');
      
      // Call completion callback
      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      toast.error('Failed to create encryption key');
      setStep('password');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUnlockExisting = async () => {
    try {
      const unlocked = await cryptoService.loadKeyPair(password);
      if (unlocked) {
        toast.success('Encryption key unlocked!');
        if (onComplete) {
          onComplete();
        }
      } else {
        toast.error('Invalid password');
      }
    } catch (error) {
      toast.error('Failed to unlock encryption key');
    }
  };

  if (hasExistingKey) {
    return (
      <div className="encryption-setup">
        <div className="shadow-card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            textAlign: 'center',
            color: 'var(--corrupt-green)'
          }}>
            🔓 UNLOCK ENCRYPTION KEY
          </h3>
          
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            color: 'var(--static-gray)',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            Enter your password to unlock your encryption key
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.813rem',
              color: 'var(--ghost-white)',
              marginBottom: '0.5rem'
            }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUnlockExisting()}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--shadow-void)',
                  border: '1px solid var(--neon-violet)',
                  borderRadius: 'var(--radius-sharp)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: 'var(--ghost-white)'
                }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--static-gray)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem'
                }}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleUnlockExisting}
              className="btn-neon"
              style={{ flex: 1 }}
            >
              UNLOCK
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="btn-shadow"
                style={{ flex: 1 }}
              >
                SKIP
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="encryption-setup">
      <div className="shadow-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        {step === 'intro' && (
          <>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
              color: 'var(--corrupt-green)'
            }}>
              🔐 SECURE YOUR SHADOW ITEMS
            </h3>
            
            <div style={{
              background: 'var(--shadow-void)',
              border: '1px solid var(--signal-blue)',
              borderRadius: 'var(--radius-sharp)',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--ghost-white)',
                marginBottom: '1rem'
              }}>
                <strong>End-to-End Encryption</strong> protects your GitHub commits and social posts
              </p>
              <ul style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.813rem',
                color: 'var(--static-gray)',
                paddingLeft: '1.5rem',
                margin: 0
              }}>
                <li>Only YOU can decrypt your content</li>
                <li>Backend never sees your private key</li>
                <li>Content encrypted before leaving your device</li>
                <li>Secure key storage in your browser</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep('password')}
                className="btn-neon"
                style={{ flex: 1 }}
              >
                CREATE ENCRYPTION KEY
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="btn-shadow"
                  style={{ flex: 1 }}
                >
                  SKIP FOR NOW
                </button>
              )}
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
              color: 'var(--corrupt-green)'
            }}>
              🔑 CREATE KEY PASSWORD
            </h3>

            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.813rem',
              color: 'var(--static-gray)',
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              This password encrypts your private key locally.
              <br />
              <strong style={{ color: 'var(--error-crimson)' }}>
                IMPORTANT: This cannot be recovered if lost!
              </strong>
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.813rem',
                color: 'var(--ghost-white)',
                marginBottom: '0.5rem'
              }}>
                PASSWORD
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--shadow-void)',
                  border: '1px solid var(--neon-violet)',
                  borderRadius: 'var(--radius-sharp)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: 'var(--ghost-white)'
                }}
                placeholder="Min 8 characters"
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.813rem',
                color: 'var(--ghost-white)',
                marginBottom: '0.5rem'
              }}>
                CONFIRM PASSWORD
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerateKey()}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--shadow-void)',
                  border: '1px solid var(--neon-violet)',
                  borderRadius: 'var(--radius-sharp)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: 'var(--ghost-white)'
                }}
                placeholder="Confirm password"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleGenerateKey}
                className="btn-neon"
                style={{ flex: 1 }}
                disabled={!password || password !== confirmPassword}
              >
                GENERATE KEY
              </button>
              <button
                onClick={() => setStep('intro')}
                className="btn-shadow"
                style={{ flex: 1 }}
              >
                BACK
              </button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="loading-dots" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--neon-violet)'
            }}>
              GENERATING ENCRYPTION KEY...
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--static-gray)',
              marginTop: '0.5rem'
            }}>
              Please sign the message in your wallet
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem',
              color: 'var(--corrupt-green)'
            }}>
              ✓
            </div>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              marginBottom: '0.5rem',
              color: 'var(--corrupt-green)'
            }}>
              ENCRYPTION KEY CREATED!
            </h3>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              color: 'var(--static-gray)'
            }}>
              Your shadow items will now be encrypted end-to-end
            </p>
          </div>
        )}
      </div>
    </div>
  );
};