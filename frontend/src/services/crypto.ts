/**
 * Frontend Crypto Service for Shadowchain
 * Handles X25519 key generation, storage, and decryption in the browser
 * Uses tweetnacl for cryptographic operations (pure JavaScript)
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { Buffer } from 'buffer';

// Ensure Buffer is available globally for compatibility
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

export interface EncryptionKeyPair {
  publicKey: string; // hex encoded
  privateKey: string; // hex encoded
}

export interface StoredKeyPair {
  publicKey: string;
  encryptedPrivateKey: string; // encrypted with password
  salt: string;
  nonce: string;
}

export interface DecryptedContent {
  content: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter';
}

class CryptoService {
  private readonly NONCE_LENGTH = nacl.secretbox.nonceLength;
  private readonly KEY_LENGTH = nacl.secretbox.keyLength;
  private readonly BOX_NONCE_LENGTH = nacl.box.nonceLength;
  private readonly SALT_LENGTH = 16; // For password hashing
  private currentKeyPair: EncryptionKeyPair | null = null;

  /**
   * Generate a new X25519 keypair for encryption
   */
  async generateKeyPair(): Promise<EncryptionKeyPair> {
    const keypair = nacl.box.keyPair();
    
    return {
      publicKey: naclUtil.encodeBase64(keypair.publicKey).replace(/\//g, '_').replace(/\+/g, '-'),
      privateKey: naclUtil.encodeBase64(keypair.secretKey).replace(/\//g, '_').replace(/\+/g, '-')
    };
  }

  /**
   * Generate keypair from a seed (for deterministic key generation)
   */
  async generateKeyPairFromSeed(seed: Uint8Array): Promise<EncryptionKeyPair> {
    if (seed.length !== 32) {
      throw new Error(`Seed must be 32 bytes`);
    }
    
    const keypair = nacl.box.keyPair.fromSecretKey(seed);
    
    return {
      publicKey: naclUtil.encodeBase64(keypair.publicKey).replace(/\//g, '_').replace(/\+/g, '-'),
      privateKey: naclUtil.encodeBase64(keypair.secretKey).replace(/\//g, '_').replace(/\+/g, '-')
    };
  }

  /**
   * Derive a key from password using PBKDF2-like approach
   */
  private async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    // Use a simple PBKDF2-like approach with nacl.hash
    // This is a simplified version - in production, consider using a proper PBKDF2 implementation
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    
    // Combine password and salt
    const combined = new Uint8Array(passwordBytes.length + salt.length);
    combined.set(passwordBytes, 0);
    combined.set(salt, passwordBytes.length);
    
    // Hash multiple times for key stretching
    let hash = nacl.hash(combined);
    for (let i = 0; i < 1000; i++) {
      hash = nacl.hash(hash);
    }
    
    // Take first 32 bytes for key
    return hash.slice(0, 32);
  }

  /**
   * Encrypt private key with password for secure storage
   */
  async encryptPrivateKey(privateKey: string, password: string): Promise<{
    encryptedKey: string;
    salt: string;
    nonce: string;
  }> {
    // Generate salt and nonce
    const salt = nacl.randomBytes(this.SALT_LENGTH);
    const nonce = nacl.randomBytes(this.NONCE_LENGTH);
    
    // Derive key from password
    const key = await this.deriveKeyFromPassword(password, salt);
    
    // Decode private key from base64
    const privateKeyBytes = naclUtil.decodeBase64(privateKey.replace(/_/g, '/').replace(/-/g, '+'));
    
    // Encrypt private key
    const encryptedKey = nacl.secretbox(privateKeyBytes, nonce, key);
    
    // Clear sensitive data
    key.fill(0);
    privateKeyBytes.fill(0);
    
    return {
      encryptedKey: naclUtil.encodeBase64(encryptedKey),
      salt: naclUtil.encodeBase64(salt),
      nonce: naclUtil.encodeBase64(nonce)
    };
  }

  /**
   * Decrypt private key with password
   */
  async decryptPrivateKey(
    encryptedKey: string,
    password: string,
    salt: string,
    nonce: string
  ): Promise<string> {
    const saltBytes = naclUtil.decodeBase64(salt);
    const nonceBytes = naclUtil.decodeBase64(nonce);
    const encryptedKeyBytes = naclUtil.decodeBase64(encryptedKey);
    
    // Derive key from password
    const key = await this.deriveKeyFromPassword(password, saltBytes);
    
    try {
      // Decrypt private key
      const privateKeyBytes = nacl.secretbox.open(encryptedKeyBytes, nonceBytes, key);
      
      if (!privateKeyBytes) {
        throw new Error('Failed to decrypt - invalid password');
      }
      
      const privateKey = naclUtil.encodeBase64(privateKeyBytes).replace(/\//g, '_').replace(/\+/g, '-');
      
      // Clear sensitive data
      privateKeyBytes.fill(0);
      
      return privateKey;
    } finally {
      // Always clear the derived key
      key.fill(0);
    }
  }

  /**
   * Store keypair securely in localStorage
   */
  async storeKeyPair(keyPair: EncryptionKeyPair, password: string): Promise<void> {
    const encrypted = await this.encryptPrivateKey(keyPair.privateKey, password);
    
    const storedKeyPair: StoredKeyPair = {
      publicKey: keyPair.publicKey,
      encryptedPrivateKey: encrypted.encryptedKey,
      salt: encrypted.salt,
      nonce: encrypted.nonce
    };
    
    localStorage.setItem('shadowchain_encryption_key', JSON.stringify(storedKeyPair));
    
    // Also set as current keypair
    this.currentKeyPair = keyPair;
  }

  /**
   * Load keypair from localStorage
   */
  async loadKeyPair(password: string): Promise<EncryptionKeyPair | null> {
    const stored = localStorage.getItem('shadowchain_encryption_key');
    if (!stored) return null;
    
    try {
      const storedKeyPair: StoredKeyPair = JSON.parse(stored);
      
      const privateKey = await this.decryptPrivateKey(
        storedKeyPair.encryptedPrivateKey,
        password,
        storedKeyPair.salt,
        storedKeyPair.nonce
      );
      
      const keyPair = {
        publicKey: storedKeyPair.publicKey,
        privateKey
      };
      
      // Set as current keypair
      this.currentKeyPair = keyPair;
      
      return keyPair;
    } catch (error) {
      console.error('Failed to load keypair:', error);
      return null;
    }
  }

  /**
   * Check if a keypair exists in storage
   */
  hasStoredKeyPair(): boolean {
    return localStorage.getItem('shadowchain_encryption_key') !== null;
  }

  /**
   * Clear stored keypair
   */
  clearStoredKeyPair(): void {
    localStorage.removeItem('shadowchain_encryption_key');
    this.currentKeyPair = null;
  }

  /**
   * Get current keypair (if loaded)
   */
  getCurrentKeyPair(): EncryptionKeyPair | null {
    return this.currentKeyPair;
  }

  /**
   * Convert hex to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to hex
   */
  private uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Decrypt symmetric key using private key
   */
  async decryptSymmetricKey(
    encryptedKey: string,
    publicKey: string,
    privateKey: string
  ): Promise<Uint8Array> {
    const encryptedKeyBytes = this.hexToUint8Array(encryptedKey);
    const privateKeyBytes = naclUtil.decodeBase64(privateKey.replace(/_/g, '/').replace(/-/g, '+'));
    
    // Extract components from sealed box format
    const ephemeralPublicKey = encryptedKeyBytes.slice(0, nacl.box.publicKeyLength);
    const nonce = encryptedKeyBytes.slice(nacl.box.publicKeyLength, nacl.box.publicKeyLength + this.BOX_NONCE_LENGTH);
    const ciphertext = encryptedKeyBytes.slice(nacl.box.publicKeyLength + this.BOX_NONCE_LENGTH);
    
    // Decrypt using nacl.box.open
    const decrypted = nacl.box.open(ciphertext, nonce, ephemeralPublicKey, privateKeyBytes);
    
    if (!decrypted) {
      throw new Error('Failed to decrypt symmetric key');
    }
    
    // Clear sensitive data
    privateKeyBytes.fill(0);
    
    return decrypted;
  }

  /**
   * Decrypt content using XChaCha20-Poly1305
   */
  async decryptContent(
    ciphertext: string,
    nonce: string,
    symmetricKey: Uint8Array
  ): Promise<string> {
    const ciphertextBytes = this.hexToUint8Array(ciphertext);
    const nonceBytes = this.hexToUint8Array(nonce);
    
    try {
      // Use secretbox for symmetric decryption (XSalsa20-Poly1305)
      const plaintext = nacl.secretbox.open(ciphertextBytes, nonceBytes, symmetricKey);
      
      if (!plaintext) {
        throw new Error('Failed to decrypt content');
      }
      
      return new TextDecoder().decode(plaintext);
    } finally {
      // Clear symmetric key
      symmetricKey.fill(0);
    }
  }

  /**
   * Decrypt shadow item from blockchain
   */
  async decryptShadowItem(
    ciphertext: string,
    nonce: string,
    encryptedKey: string
  ): Promise<DecryptedContent | null> {
    if (!this.currentKeyPair) {
      throw new Error('No keypair loaded. Please unlock your encryption keys.');
    }
    
    try {
      // Decrypt the symmetric key
      const symmetricKey = await this.decryptSymmetricKey(
        encryptedKey,
        this.currentKeyPair.publicKey,
        this.currentKeyPair.privateKey
      );
      
      // Decrypt the content
      const decryptedJson = await this.decryptContent(ciphertext, nonce, symmetricKey);
      
      // Parse the decrypted content
      const content = JSON.parse(decryptedJson);
      
      return {
        content: content.body || content.content || '',
        timestamp: content.timestamp,
        source: content.source
      };
    } catch (error) {
      console.error('Failed to decrypt shadow item:', error);
      return null;
    }
  }

  /**
   * Create a signature message for key ownership proof
   */
  createKeyOwnershipMessage(polkadotAddress: string, encryptionPublicKey: string): string {
    return `I authorize Shadowchain to use encryption key ${encryptionPublicKey} for my account ${polkadotAddress}`;
  }

  /**
   * Export keypair (encrypted)
   */
  async exportKeyPair(password: string): Promise<string> {
    const stored = localStorage.getItem('shadowchain_encryption_key');
    if (!stored) throw new Error('No keypair to export');
    
    const exportData = {
      version: 1,
      timestamp: Date.now(),
      data: JSON.parse(stored)
    };
    
    // Additional encryption layer for export
    const exportPassword = `shadowchain_export_${password}`;
    const exportString = JSON.stringify(exportData);
    const encoder = new TextEncoder();
    const exportBytes = encoder.encode(exportString);
    
    // Generate salt and nonce for export
    const salt = nacl.randomBytes(this.SALT_LENGTH);
    const nonce = nacl.randomBytes(this.NONCE_LENGTH);
    
    // Derive key from export password
    const key = await this.deriveKeyFromPassword(exportPassword, salt);
    
    // Encrypt the export data
    const encrypted = nacl.secretbox(exportBytes, nonce, key);
    
    // Clear sensitive data
    key.fill(0);
    
    return JSON.stringify({
      type: 'shadowchain_keypair_export',
      encrypted: naclUtil.encodeBase64(encrypted),
      salt: naclUtil.encodeBase64(salt),
      nonce: naclUtil.encodeBase64(nonce)
    });
  }

  /**
   * Import keypair
   */
  async importKeyPair(exportedData: string, password: string): Promise<void> {
    try {
      const parsed = JSON.parse(exportedData);
      if (parsed.type !== 'shadowchain_keypair_export') {
        throw new Error('Invalid export format');
      }
      
      const exportPassword = `shadowchain_export_${password}`;
      const salt = naclUtil.decodeBase64(parsed.salt);
      const nonce = naclUtil.decodeBase64(parsed.nonce);
      const encrypted = naclUtil.decodeBase64(parsed.encrypted);
      
      // Derive key from export password
      const key = await this.deriveKeyFromPassword(exportPassword, salt);
      
      // Decrypt the export data
      const decrypted = nacl.secretbox.open(encrypted, nonce, key);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt - invalid password');
      }
      
      // Clear sensitive data
      key.fill(0);
      
      const decoder = new TextDecoder();
      const exportData = JSON.parse(decoder.decode(decrypted));
      
      // Store the imported keypair
      localStorage.setItem('shadowchain_encryption_key', JSON.stringify(exportData.data));
      
      // Try to load it
      await this.loadKeyPair(password);
    } catch (error) {
      throw new Error('Failed to import keypair: ' + (error as Error).message);
    }
  }

  /**
   * Generate a secure password hint (first and last 3 chars)
   */
  generatePasswordHint(password: string): string {
    if (password.length <= 6) return '*'.repeat(password.length);
    return password.slice(0, 3) + '*'.repeat(password.length - 6) + password.slice(-3);
  }

  /**
   * Check if stored keys exist and their status
   */
  async loadStoredKeys(): Promise<{ unlocked: boolean } | null> {
    const stored = localStorage.getItem('shadowchain_encryption_key');
    if (!stored) {
      return null;
    }

    // Keys exist but we need to check if they're unlocked (loaded in memory)
    return {
      unlocked: this.currentKeyPair !== null
    };
  }

  /**
   * Export keys for backup (simplified version for UI)
   */
  async exportKeys(): Promise<{ publicKey: string; encryptedPrivateKey: string; salt: string; nonce: string } | null> {
    const stored = localStorage.getItem('shadowchain_encryption_key');
    if (!stored) {
      return null;
    }

    try {
      const storedKeyPair: StoredKeyPair = JSON.parse(stored);
      return {
        publicKey: storedKeyPair.publicKey,
        encryptedPrivateKey: storedKeyPair.encryptedPrivateKey,
        salt: storedKeyPair.salt,
        nonce: storedKeyPair.nonce
      };
    } catch (error) {
      console.error('Failed to export keys:', error);
      return null;
    }
  }

  /**
   * Import keys from backup (simplified version for UI)
   */
  async importKeys(keys: { publicKey: string; encryptedPrivateKey: string; salt?: string; nonce?: string }): Promise<boolean> {
    try {
      // Handle both full export format and simplified format
      let storedKeyPair: StoredKeyPair;
      
      if (keys.salt && keys.nonce) {
        // Direct import of encrypted keys
        storedKeyPair = {
          publicKey: keys.publicKey,
          encryptedPrivateKey: keys.encryptedPrivateKey,
          salt: keys.salt,
          nonce: keys.nonce
        };
      } else {
        // Legacy format or incomplete data
        console.error('Invalid key format - missing salt or nonce');
        return false;
      }

      // Store the imported keypair
      localStorage.setItem('shadowchain_encryption_key', JSON.stringify(storedKeyPair));
      
      // Don't automatically load - user will need to unlock with password
      this.currentKeyPair = null;
      
      return true;
    } catch (error) {
      console.error('Failed to import keys:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();