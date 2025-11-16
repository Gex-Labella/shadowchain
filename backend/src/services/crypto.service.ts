/**
 * Crypto Service for Shadowchain
 * Implements X25519 encryption for content security
 * Uses tweetnacl for cryptographic operations (pure JavaScript)
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { randomBytes } from 'crypto';
import { substrateLogger as logger } from '../utils/logger';

export interface EncryptedContent {
  ciphertext: string; // hex encoded
  nonce: string; // hex encoded  
  encryptedKey: string; // hex encoded
  encryptedSymmetricKey?: string; // alias for encryptedKey
}

export interface UserEncryptionKey {
  publicKey: string; // hex encoded
  address: string; // Polkadot address
  signedMessage?: string; // sr25519 signature proving ownership
  createdAt: Date;
}

export class CryptoService {
  private readonly NONCE_LENGTH = nacl.secretbox.nonceLength;
  private readonly KEY_LENGTH = nacl.secretbox.keyLength;
  private readonly BOX_NONCE_LENGTH = nacl.box.nonceLength;

  /**
   * Generate a new X25519 keypair for encryption
   */
  generateKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
    const keypair = nacl.box.keyPair();
    
    return { 
      publicKey: Buffer.from(keypair.publicKey),
      privateKey: Buffer.from(keypair.secretKey)
    };
  }

  /**
   * Generate a random symmetric key for content encryption
   */
  generateSymmetricKey(): Buffer {
    return randomBytes(this.KEY_LENGTH);
  }

  /**
   * Encrypt content using secret box (XSalsa20-Poly1305)
   */
  encryptContent(content: Buffer | string, symmetricKey: Buffer): { ciphertext: Buffer; nonce: Buffer } {
    const plaintext = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nonce = randomBytes(this.NONCE_LENGTH);
    
    // Convert to Uint8Array for nacl
    const message = new Uint8Array(plaintext);
    const nonceArray = new Uint8Array(nonce);
    const keyArray = new Uint8Array(symmetricKey);
    
    const ciphertext = nacl.secretbox(message, nonceArray, keyArray);
    
    return { 
      ciphertext: Buffer.from(ciphertext),
      nonce: nonce
    };
  }

  /**
   * Decrypt content using secret box (XSalsa20-Poly1305)
   */
  decryptContent(ciphertext: Buffer, nonce: Buffer, symmetricKey: Buffer): Buffer {
    const ciphertextArray = new Uint8Array(ciphertext);
    const nonceArray = new Uint8Array(nonce);
    const keyArray = new Uint8Array(symmetricKey);
    
    const plaintext = nacl.secretbox.open(ciphertextArray, nonceArray, keyArray);
    
    if (!plaintext) {
      throw new Error('Decryption failed');
    }
    
    return Buffer.from(plaintext);
  }

  /**
   * Encrypt a symmetric key using user's public key
   * This creates an encrypted box that can only be opened with the recipient's private key
   */
  encryptSymmetricKey(symmetricKey: Buffer, userPublicKey: Buffer): Buffer {
    // Generate ephemeral keypair for this encryption
    const ephemeralKeypair = nacl.box.keyPair();
    
    // Create a nonce
    const nonce = randomBytes(this.BOX_NONCE_LENGTH);
    
    // Encrypt the symmetric key
    const messageArray = new Uint8Array(symmetricKey);
    const nonceArray = new Uint8Array(nonce);
    const publicKeyArray = new Uint8Array(userPublicKey);
    const secretKeyArray = new Uint8Array(ephemeralKeypair.secretKey);
    
    const encrypted = nacl.box(messageArray, nonceArray, publicKeyArray, secretKeyArray);
    
    // Combine ephemeral public key + nonce + encrypted data
    // This provides forward secrecy similar to crypto_box_seal
    const sealed = Buffer.concat([
      Buffer.from(ephemeralKeypair.publicKey),
      nonce,
      Buffer.from(encrypted)
    ]);
    
    return sealed;
  }

  /**
   * Decrypt a symmetric key using user's private key
   */
  decryptSymmetricKey(encryptedKey: Buffer, publicKey: Buffer, privateKey: Buffer): Buffer {
    // Extract components
    const ephemeralPublicKey = encryptedKey.slice(0, nacl.box.publicKeyLength);
    const nonce = encryptedKey.slice(nacl.box.publicKeyLength, nacl.box.publicKeyLength + this.BOX_NONCE_LENGTH);
    const ciphertext = encryptedKey.slice(nacl.box.publicKeyLength + this.BOX_NONCE_LENGTH);
    
    // Decrypt
    const ciphertextArray = new Uint8Array(ciphertext);
    const nonceArray = new Uint8Array(nonce);
    const ephemeralPublicKeyArray = new Uint8Array(ephemeralPublicKey);
    const privateKeyArray = new Uint8Array(privateKey);
    
    const decrypted = nacl.box.open(ciphertextArray, nonceArray, ephemeralPublicKeyArray, privateKeyArray);
    
    if (!decrypted) {
      throw new Error('Failed to decrypt symmetric key');
    }
    
    return Buffer.from(decrypted);
  }

  /**
   * Encrypt content for a user
   * 1. Generate symmetric key
   * 2. Encrypt content with symmetric key
   * 3. Encrypt symmetric key with user's public key
   */
  async encryptForUser(
    content: string | Buffer,
    userPublicKeyHex: string | Buffer
  ): Promise<EncryptedContent> {
    try {
      // Parse user's public key
      const userPublicKey = Buffer.isBuffer(userPublicKeyHex) 
        ? userPublicKeyHex 
        : Buffer.from(userPublicKeyHex, 'hex');
      
      if (userPublicKey.length !== nacl.box.publicKeyLength) {
        throw new Error('Invalid public key length');
      }

      // Generate symmetric key
      const symmetricKey = this.generateSymmetricKey();

      // Encrypt content
      const { ciphertext, nonce } = this.encryptContent(content, symmetricKey);

      // Encrypt symmetric key with user's public key
      const encryptedKey = this.encryptSymmetricKey(symmetricKey, userPublicKey);

      // Clear symmetric key from memory
      symmetricKey.fill(0);

      logger.info({
        contentSize: Buffer.isBuffer(content) ? content.length : Buffer.from(content).length,
        ciphertextSize: ciphertext.length,
        encryptedKeySize: encryptedKey.length
      }, 'Content encrypted successfully');

      return {
        ciphertext: ciphertext.toString('hex'),
        nonce: nonce.toString('hex'),
        encryptedKey: encryptedKey.toString('hex'),
        encryptedSymmetricKey: encryptedKey.toString('hex') // alias for compatibility
      };
    } catch (error) {
      logger.error({ error }, 'Failed to encrypt content for user');
      throw error;
    }
  }

  /**
   * Decrypt content with private key
   * 1. Decrypt symmetric key with private key
   * 2. Decrypt content with symmetric key
   */
  async decryptWithPrivateKey(
    ciphertextHex: string,
    nonceHex: string,
    encryptedKeyHex: string,
    privateKeyHex: string | Buffer,
    publicKeyHex?: string | Buffer
  ): Promise<string> {
    try {
      // Parse keys and data
      const privateKey = Buffer.isBuffer(privateKeyHex) 
        ? privateKeyHex 
        : Buffer.from(privateKeyHex, 'hex');
      
      // If public key not provided, derive it from private key
      let publicKey: Buffer;
      if (publicKeyHex) {
        publicKey = Buffer.isBuffer(publicKeyHex) 
          ? publicKeyHex 
          : Buffer.from(publicKeyHex, 'hex');
      } else {
        // Derive public key from private key using nacl
        const keypair = nacl.box.keyPair.fromSecretKey(new Uint8Array(privateKey));
        publicKey = Buffer.from(keypair.publicKey);
      }

      const ciphertext = Buffer.from(ciphertextHex, 'hex');
      const nonce = Buffer.from(nonceHex, 'hex');
      const encryptedKey = Buffer.from(encryptedKeyHex, 'hex');

      // Decrypt symmetric key
      const symmetricKey = this.decryptSymmetricKey(encryptedKey, publicKey, privateKey);

      // Decrypt content
      const plaintext = this.decryptContent(ciphertext, nonce, symmetricKey);

      // Clear symmetric key from memory
      symmetricKey.fill(0);

      return plaintext.toString('utf8');
    } catch (error) {
      logger.error({ error }, 'Failed to decrypt content with private key');
      throw error;
    }
  }

  /**
   * Create a message for user to sign to prove ownership of encryption key
   */
  createKeyOwnershipMessage(
    polkadotAddress: string,
    encryptionPublicKeyHex: string
  ): string {
    return `I authorize Shadowchain to use encryption key ${encryptionPublicKeyHex} for my account ${polkadotAddress}`;
  }

  /**
   * Validate that a public key is properly formatted
   */
  validatePublicKey(publicKeyHex: string): boolean {
    try {
      const publicKey = Buffer.from(publicKeyHex, 'hex');
      return publicKey.length === nacl.box.publicKeyLength;
    } catch {
      return false;
    }
  }

  /**
   * Convert key to hex string for storage/transmission
   */
  keyToHex(key: Buffer): string {
    return key.toString('hex');
  }

  /**
   * Convert hex string to key buffer
   */
  hexToKey(hex: string): Buffer {
    return Buffer.from(hex, 'hex');
  }

  /**
   * Generate a deterministic encryption keypair from a seed
   * Useful for key recovery scenarios
   */
  generateKeyPairFromSeed(seed: Buffer): { publicKey: Buffer; privateKey: Buffer } {
    // In tweetnacl, seeds for box keypairs should be 32 bytes
    if (seed.length !== 32) {
      throw new Error(`Seed must be 32 bytes`);
    }

    // For deterministic key generation, use the seed as a secret key
    // Note: tweetnacl doesn't have direct seed-based generation like sodium,
    // so we'll use the seed as the secret key
    const secretKey = new Uint8Array(32);
    seed.copy(secretKey, 0, 0, 32);
    
    const keypair = nacl.box.keyPair.fromSecretKey(secretKey);
    
    return {
      publicKey: Buffer.from(keypair.publicKey),
      privateKey: Buffer.from(keypair.secretKey)
    };
  }

  /**
   * Compute a shared secret between two keypairs (for future use)
   * This could be used for more advanced encryption scenarios
   */
  computeSharedSecret(
    publicKey: Buffer,
    privateKey: Buffer
  ): Buffer {
    const publicKeyArray = new Uint8Array(publicKey);
    const privateKeyArray = new Uint8Array(privateKey);
    
    const sharedSecret = nacl.box.before(publicKeyArray, privateKeyArray);
    
    return Buffer.from(sharedSecret);
  }

  /**
   * Zero out sensitive data in memory
   */
  secureClear(buffer: Buffer): void {
    buffer.fill(0);
  }

  /**
   * Helper method to encode data to base64 (alternative to hex)
   */
  encodeBase64(data: Buffer): string {
    return naclUtil.encodeBase64(new Uint8Array(data));
  }

  /**
   * Helper method to decode base64 data
   */
  decodeBase64(data: string): Buffer {
    return Buffer.from(naclUtil.decodeBase64(data));
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();