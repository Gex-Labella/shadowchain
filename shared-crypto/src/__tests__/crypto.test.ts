/**
 * Tests for Shadow Chain Cryptography Module
 */

import * as crypto from '../index';
import { stringToU8a, u8aToString } from '@polkadot/util';
import * as sodium from 'libsodium-wrappers-sumo';

// Mock sr25519 private key for testing (32 bytes)
const TEST_SR25519_PRIVATE_KEY = new Uint8Array(32).fill(1);

describe('Shadow Chain Crypto Module', () => {
  beforeAll(async () => {
    await crypto.ensureSodiumReady();
  });

  describe('Key Generation', () => {
    test('should generate symmetric key', async () => {
      const key = await crypto.generateSymmetricKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32); // 256-bit key
    });

    test('should generate nonce for secretbox', async () => {
      const nonce = await crypto.generateNonce('secretbox');
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(24); // 192-bit nonce
    });

    test('should generate nonce for box', async () => {
      const nonce = await crypto.generateNonce('box');
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(24); // 192-bit nonce
    });

    test('should derive X25519 keypair from sr25519', async () => {
      const keyPair = await crypto.deriveEncryptionKeyPair(TEST_SR25519_PRIVATE_KEY);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.privateKey.length).toBe(32);
    });
  });

  describe('Symmetric Encryption', () => {
    let symmetricKey: Uint8Array;

    beforeAll(async () => {
      symmetricKey = await crypto.generateSymmetricKey();
    });

    test('should encrypt and decrypt string', async () => {
      const plaintext = 'Hello, Shadow Chain!';
      
      const encrypted = await crypto.encryptSymmetric(plaintext, symmetricKey);
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
      
      const decrypted = await crypto.decryptSymmetric(encrypted, symmetricKey);
      expect(u8aToString(decrypted)).toBe(plaintext);
    });

    test('should encrypt and decrypt Uint8Array', async () => {
      const plaintext = stringToU8a('Binary data test');
      
      const encrypted = await crypto.encryptSymmetric(plaintext, symmetricKey);
      const decrypted = await crypto.decryptSymmetric(encrypted, symmetricKey);
      
      expect(decrypted).toEqual(plaintext);
    });

    test('should fail decryption with wrong key', async () => {
      const plaintext = 'Secret message';
      const wrongKey = await crypto.generateSymmetricKey();
      
      const encrypted = await crypto.encryptSymmetric(plaintext, symmetricKey);
      
      await expect(
        crypto.decryptSymmetric(encrypted, wrongKey)
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('Asymmetric Encryption', () => {
    let recipientKeyPair: crypto.EncryptionKeyPair;

    beforeAll(async () => {
      recipientKeyPair = await crypto.deriveEncryptionKeyPair(TEST_SR25519_PRIVATE_KEY);
    });

    test('should encrypt and decrypt with public/private keys', async () => {
      const plaintext = stringToU8a('Asymmetric test data');
      
      const encrypted = await crypto.encryptAsymmetric(
        plaintext,
        recipientKeyPair.publicKey
      );
      
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
      expect(encrypted.ephemeralPublicKey).toBeInstanceOf(Uint8Array);
      
      const decrypted = await crypto.decryptAsymmetric(
        encrypted,
        recipientKeyPair.privateKey
      );
      
      expect(decrypted).toEqual(plaintext);
    });

    test('should fail decryption with wrong private key', async () => {
      const plaintext = stringToU8a('Secret key data');
      const wrongKeyPair = await crypto.deriveEncryptionKeyPair(new Uint8Array(32).fill(2));
      
      const encrypted = await crypto.encryptAsymmetric(
        plaintext,
        recipientKeyPair.publicKey
      );
      
      await expect(
        crypto.decryptAsymmetric(encrypted, wrongKeyPair.privateKey)
      ).rejects.toThrow('Asymmetric decryption failed');
    });
  });

  describe('Full Encryption Flow', () => {
    let userKeyPair: crypto.EncryptionKeyPair;

    beforeAll(async () => {
      userKeyPair = await crypto.deriveEncryptionKeyPair(TEST_SR25519_PRIVATE_KEY);
    });

    test('should encrypt and decrypt ShadowContent', async () => {
      const content: crypto.ShadowContent = {
        source: 'github',
        url: 'https://github.com/user/repo/commit/123',
        body: 'Initial commit: Add awesome feature',
        timestamp: Date.now(),
        raw_meta: {
          author: 'developer',
          files_changed: 5
        }
      };
      
      const encrypted = await crypto.encryptContent(content, userKeyPair.publicKey);
      
      expect(encrypted.encryptedContent.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.encryptedKey.ciphertext).toBeInstanceOf(Uint8Array);
      expect(encrypted.symmetricKey).toBeInstanceOf(Uint8Array);
      
      const decrypted = await crypto.decryptContent(
        encrypted.encryptedContent,
        encrypted.encryptedKey,
        userKeyPair.privateKey
      );
      
      const parsedContent = JSON.parse(decrypted);
      expect(parsedContent).toEqual(content);
    });

    test('should encrypt and decrypt plain string', async () => {
      const content = 'Just a simple tweet about Web3';
      
      const encrypted = await crypto.encryptContent(content, userKeyPair.publicKey);
      const decrypted = await crypto.decryptContent(
        encrypted.encryptedContent,
        encrypted.encryptedKey,
        userKeyPair.privateKey
      );
      
      expect(decrypted).toBe(content);
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize encrypted payload', async () => {
      const payload: crypto.EncryptedPayload = {
        ciphertext: new Uint8Array([1, 2, 3, 4, 5]),
        nonce: new Uint8Array([6, 7, 8, 9, 10]),
        ephemeralPublicKey: new Uint8Array([11, 12, 13, 14, 15])
      };
      
      const serialized = crypto.serializeEncryptedPayload(payload);
      expect(typeof serialized).toBe('string');
      
      const deserialized = crypto.deserializeEncryptedPayload(serialized);
      expect(deserialized.ciphertext).toEqual(payload.ciphertext);
      expect(deserialized.nonce).toEqual(payload.nonce);
      expect(deserialized.ephemeralPublicKey).toEqual(payload.ephemeralPublicKey);
    });

    test('should handle payload without ephemeral key', () => {
      const payload: crypto.EncryptedPayload = {
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: new Uint8Array([4, 5, 6])
      };
      
      const serialized = crypto.serializeEncryptedPayload(payload);
      const deserialized = crypto.deserializeEncryptedPayload(serialized);
      
      expect(deserialized.ephemeralPublicKey).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    test('should generate random ID', async () => {
      const id1 = await crypto.generateId();
      const id2 = await crypto.generateId();
      
      expect(typeof id1).toBe('string');
      expect(id1.length).toBe(66); // '0x' + 64 hex chars
      expect(id1).not.toBe(id2); // Should be unique
    });

    test('should perform secure cleanup', () => {
      const sensitive1 = new Uint8Array([1, 2, 3, 4, 5]);
      const sensitive2 = new Uint8Array([6, 7, 8, 9, 10]);
      
      crypto.secureCleanup(sensitive1, sensitive2);
      
      expect(sensitive1.every(byte => byte === 0)).toBe(true);
      expect(sensitive2.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty content', async () => {
      const key = await crypto.generateSymmetricKey();
      const encrypted = await crypto.encryptSymmetric('', key);
      const decrypted = await crypto.decryptSymmetric(encrypted, key);
      
      expect(u8aToString(decrypted)).toBe('');
    });

    test('should handle large content', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB
      const key = await crypto.generateSymmetricKey();
      
      const encrypted = await crypto.encryptSymmetric(largeContent, key);
      const decrypted = await crypto.decryptSymmetric(encrypted, key);
      
      expect(u8aToString(decrypted)).toBe(largeContent);
    });

    test('should reject decryption with missing ephemeral key', async () => {
      const encrypted: crypto.EncryptedPayload = {
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: new Uint8Array([4, 5, 6])
        // Missing ephemeralPublicKey
      };
      
      await expect(
        crypto.decryptAsymmetric(encrypted, new Uint8Array(32))
      ).rejects.toThrow('Missing ephemeral public key');
    });
  });
});