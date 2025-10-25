/**
 * Shadow Chain Cryptography Module
 * 
 * Implements secure encryption/decryption using libsodium
 * - Symmetric encryption: XSalsa20-Poly1305 for content
 * - Asymmetric encryption: X25519-XSalsa20-Poly1305 for keys
 * - Key derivation: sr25519 to X25519 conversion
 */

import * as sodium from 'libsodium-wrappers-sumo';
import { hexToU8a, u8aToHex, stringToU8a, u8aToString } from '@polkadot/util';
import { sr25519ToX25519, encodeAddress, decodeAddress } from '@polkadot/util-crypto';

// Ensure sodium is ready before any crypto operations
let sodiumReady = false;
const sodiumPromise = sodium.ready.then(() => {
  sodiumReady = true;
});

/**
 * Ensure sodium is initialized
 */
export async function ensureSodiumReady(): Promise<void> {
  if (!sodiumReady) {
    await sodiumPromise;
  }
}

/**
 * Encrypted payload structure
 */
export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublicKey?: Uint8Array; // Used for asymmetric encryption
}

/**
 * Shadow content structure (before encryption)
 */
export interface ShadowContent {
  source: 'github' | 'twitter';
  url: string;
  body: string;
  timestamp: number;
  raw_meta: Record<string, any>;
}

/**
 * Key pair for encryption
 */
export interface EncryptionKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Result of content encryption
 */
export interface EncryptedContentResult {
  encryptedContent: EncryptedPayload;
  encryptedKey: EncryptedPayload;
  symmetricKey: Uint8Array;
}

/**
 * Generate a random symmetric key for content encryption
 */
export async function generateSymmetricKey(): Promise<Uint8Array> {
  await ensureSodiumReady();
  return sodium.crypto_secretbox_keygen();
}

/**
 * Generate a random nonce for encryption
 */
export async function generateNonce(size: 'secretbox' | 'box' = 'secretbox'): Promise<Uint8Array> {
  await ensureSodiumReady();
  return size === 'secretbox' 
    ? sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    : sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
}

/**
 * Derive X25519 encryption keypair from sr25519 seed
 * This allows using the same seed for both signing (sr25519) and encryption (X25519)
 */
export async function deriveEncryptionKeyPair(sr25519PrivateKey: Uint8Array): Promise<EncryptionKeyPair> {
  await ensureSodiumReady();
  
  // Convert sr25519 private key to X25519
  const x25519PrivateKey = sr25519ToX25519(sr25519PrivateKey);
  
  // Derive X25519 public key from private key
  const x25519PublicKey = sodium.crypto_scalarmult_base(x25519PrivateKey);
  
  return {
    publicKey: x25519PublicKey,
    privateKey: x25519PrivateKey
  };
}

/**
 * Encrypt content with a symmetric key (XSalsa20-Poly1305)
 */
export async function encryptSymmetric(
  content: Uint8Array | string,
  key: Uint8Array
): Promise<EncryptedPayload> {
  await ensureSodiumReady();
  
  const data = typeof content === 'string' ? stringToU8a(content) : content;
  const nonce = await generateNonce('secretbox');
  const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key);
  
  return {
    ciphertext,
    nonce
  };
}

/**
 * Decrypt content with a symmetric key
 */
export async function decryptSymmetric(
  encrypted: EncryptedPayload,
  key: Uint8Array
): Promise<Uint8Array> {
  await ensureSodiumReady();
  
  const plaintext = sodium.crypto_secretbox_open_easy(
    encrypted.ciphertext,
    encrypted.nonce,
    key
  );
  
  if (!plaintext) {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
  
  return plaintext;
}

/**
 * Encrypt a symmetric key with user's public key (X25519-XSalsa20-Poly1305)
 */
export async function encryptAsymmetric(
  data: Uint8Array,
  recipientPublicKey: Uint8Array
): Promise<EncryptedPayload> {
  await ensureSodiumReady();
  
  // Generate ephemeral keypair for this encryption
  const ephemeralKeyPair = sodium.crypto_box_keypair();
  const nonce = await generateNonce('box');
  
  const ciphertext = sodium.crypto_box_easy(
    data,
    nonce,
    recipientPublicKey,
    ephemeralKeyPair.privateKey
  );
  
  return {
    ciphertext,
    nonce,
    ephemeralPublicKey: ephemeralKeyPair.publicKey
  };
}

/**
 * Decrypt a symmetric key with user's private key
 */
export async function decryptAsymmetric(
  encrypted: EncryptedPayload,
  recipientPrivateKey: Uint8Array
): Promise<Uint8Array> {
  await ensureSodiumReady();
  
  if (!encrypted.ephemeralPublicKey) {
    throw new Error('Missing ephemeral public key for decryption');
  }
  
  const plaintext = sodium.crypto_box_open_easy(
    encrypted.ciphertext,
    encrypted.nonce,
    encrypted.ephemeralPublicKey,
    recipientPrivateKey
  );
  
  if (!plaintext) {
    throw new Error('Asymmetric decryption failed: invalid key or corrupted data');
  }
  
  return plaintext;
}

/**
 * Full encryption flow: encrypt content and its key
 */
export async function encryptContent(
  content: ShadowContent | string,
  userPublicKey: Uint8Array
): Promise<EncryptedContentResult> {
  await ensureSodiumReady();
  
  // Serialize content if it's an object
  const contentString = typeof content === 'string' 
    ? content 
    : JSON.stringify(content);
  
  // Generate symmetric key for content
  const symmetricKey = await generateSymmetricKey();
  
  // Encrypt content with symmetric key
  const encryptedContent = await encryptSymmetric(contentString, symmetricKey);
  
  // Encrypt symmetric key with user's public key
  const encryptedKey = await encryptAsymmetric(symmetricKey, userPublicKey);
  
  return {
    encryptedContent,
    encryptedKey,
    symmetricKey
  };
}

/**
 * Full decryption flow: decrypt key then content
 */
export async function decryptContent(
  encryptedContent: EncryptedPayload,
  encryptedKey: EncryptedPayload,
  userPrivateKey: Uint8Array
): Promise<string> {
  await ensureSodiumReady();
  
  // Decrypt symmetric key
  const symmetricKey = await decryptAsymmetric(encryptedKey, userPrivateKey);
  
  // Decrypt content
  const contentBytes = await decryptSymmetric(encryptedContent, symmetricKey);
  
  // Convert to string
  return u8aToString(contentBytes);
}

/**
 * Convert Polkadot address to X25519 public key for encryption
 * Note: This requires the corresponding private key to derive properly
 */
export async function polkadotAddressToEncryptionKey(
  address: string,
  sr25519PrivateKey?: Uint8Array
): Promise<Uint8Array | null> {
  await ensureSodiumReady();
  
  if (sr25519PrivateKey) {
    // If we have the private key, derive the encryption key properly
    const keyPair = await deriveEncryptionKeyPair(sr25519PrivateKey);
    return keyPair.publicKey;
  }
  
  // Without private key, we can only decode the address
  // Note: This is NOT suitable for encryption, included for completeness
  console.warn('Cannot derive encryption key without private key');
  return null;
}

/**
 * Serialize encrypted payload for storage/transmission
 */
export function serializeEncryptedPayload(payload: EncryptedPayload): string {
  return JSON.stringify({
    ciphertext: u8aToHex(payload.ciphertext),
    nonce: u8aToHex(payload.nonce),
    ephemeralPublicKey: payload.ephemeralPublicKey 
      ? u8aToHex(payload.ephemeralPublicKey) 
      : undefined
  });
}

/**
 * Deserialize encrypted payload from storage/transmission
 */
export function deserializeEncryptedPayload(serialized: string): EncryptedPayload {
  const data = JSON.parse(serialized);
  return {
    ciphertext: hexToU8a(data.ciphertext),
    nonce: hexToU8a(data.nonce),
    ephemeralPublicKey: data.ephemeralPublicKey 
      ? hexToU8a(data.ephemeralPublicKey) 
      : undefined
  };
}

/**
 * Generate a secure random ID
 */
export async function generateId(): Promise<string> {
  await ensureSodiumReady();
  const bytes = sodium.randombytes_buf(32);
  return u8aToHex(bytes);
}

/**
 * Secure memory cleanup (best effort)
 * Note: JavaScript doesn't guarantee memory zeroing
 */
export function secureCleanup(...arrays: Uint8Array[]): void {
  arrays.forEach(arr => {
    if (arr && arr.length > 0) {
      arr.fill(0);
    }
  });
}

// Export all functions and types
export default {
  ensureSodiumReady,
  generateSymmetricKey,
  generateNonce,
  deriveEncryptionKeyPair,
  encryptSymmetric,
  decryptSymmetric,
  encryptAsymmetric,
  decryptAsymmetric,
  encryptContent,
  decryptContent,
  polkadotAddressToEncryptionKey,
  serializeEncryptedPayload,
  deserializeEncryptedPayload,
  generateId,
  secureCleanup
};