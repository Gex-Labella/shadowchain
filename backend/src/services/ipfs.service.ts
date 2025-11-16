/**
 * IPFS Service for Shadowchain
 * Handles storage and retrieval of encrypted content on IPFS
 */

import config from '../config';
import { ipfsLogger as logger } from '../utils/logger';

export interface IPFSContent {
  cid: string;
  size: number;
  path?: string;
}

export interface EncryptedIPFSContent {
  ciphertext: string; // hex encoded
  nonce: string; // hex encoded
  version: number;
  algorithm: 'xchacha20poly1305';
  timestamp: number;
}

export class IPFSService {
  private client: any = null;
  private connected: boolean = false;
  private CID: any = null; // Store CID class after dynamic import

  /**
   * Initialize IPFS client connection
   */
  async connect(): Promise<void> {
    try {
      // Dynamic import for ESM modules with proper paths
      const ipfsModule = await import('ipfs-http-client/dist/src/index.js').catch(() =>
        import('ipfs-http-client')
      );
      
      const { create } = ipfsModule;
      
      // Try different import paths for multiformats
      try {
        const multiformatsModule = await import('multiformats/cid');
        this.CID = multiformatsModule.CID;
      } catch (err) {
        // Fallback: IPFS will work without CID validation
        logger.warn({ error: err }, 'Could not import CID module, CID validation disabled');
        this.CID = null;
      }
      
      // Parse IPFS URL from config
      const ipfsUrl = config.ipfsApiUrl || 'http://localhost:5001';
      const url = new URL(ipfsUrl);
      
      // Create IPFS client
      this.client = create({
        host: url.hostname,
        port: parseInt(url.port || '5001', 10),
        protocol: url.protocol.replace(':', ''),
        timeout: 30000 // 30 second timeout
      });

      // Test connection
      const id = await this.client.id();
      
      logger.info({
        id: id.id.toString(),
        version: id.agentVersion,
        protocols: id.protocols
      }, 'Connected to IPFS node');
      
      this.connected = true;
    } catch (error) {
      logger.error({ error }, 'Failed to connect to IPFS');
      this.connected = false;
      throw new Error('IPFS connection failed');
    }
  }

  /**
   * Check if IPFS is connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Upload encrypted content to IPFS
   */
  async uploadEncrypted(
    ciphertext: Buffer,
    nonce: Buffer
  ): Promise<IPFSContent> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      // Create structured content object
      const content: EncryptedIPFSContent = {
        ciphertext: ciphertext.toString('hex'),
        nonce: nonce.toString('hex'),
        version: 1,
        algorithm: 'xchacha20poly1305',
        timestamp: Date.now()
      };

      // Convert to JSON and upload
      const jsonContent = JSON.stringify(content);
      const result = await this.client!.add(jsonContent, {
        pin: true, // Pin content to prevent garbage collection
        cidVersion: 1, // Use CIDv1 for better future compatibility
      });

      logger.info({
        cid: result.cid.toString(),
        size: result.size,
        path: result.path
      }, 'Content uploaded to IPFS');

      return {
        cid: result.cid.toString(),
        size: result.size,
        path: result.path
      };
    } catch (error) {
      logger.error({ error }, 'Failed to upload to IPFS');
      throw error;
    }
  }

  /**
   * Retrieve encrypted content from IPFS
   */
  async retrieveEncrypted(cid: string): Promise<{
    ciphertext: Buffer;
    nonce: Buffer;
    metadata: Omit<EncryptedIPFSContent, 'ciphertext' | 'nonce'>;
  }> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      // Retrieve content from IPFS
      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client!.cat(cid)) {
        chunks.push(chunk);
      }
      
      // Combine chunks and parse JSON
      const data = Buffer.concat(chunks);
      const content: EncryptedIPFSContent = JSON.parse(data.toString());

      // Validate content structure
      if (!content.ciphertext || !content.nonce || !content.version || !content.algorithm) {
        throw new Error('Invalid encrypted content structure');
      }

      logger.info({
        cid,
        version: content.version,
        algorithm: content.algorithm,
        timestamp: content.timestamp
      }, 'Content retrieved from IPFS');

      return {
        ciphertext: Buffer.from(content.ciphertext, 'hex'),
        nonce: Buffer.from(content.nonce, 'hex'),
        metadata: {
          version: content.version,
          algorithm: content.algorithm,
          timestamp: content.timestamp
        }
      };
    } catch (error) {
      logger.error({ error, cid }, 'Failed to retrieve from IPFS');
      throw error;
    }
  }

  /**
   * Pin content to ensure it's not garbage collected
   */
  async pin(cid: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      await this.client!.pin.add(cid);
      logger.info({ cid }, 'Content pinned on IPFS');
    } catch (error) {
      logger.error({ error, cid }, 'Failed to pin content');
      throw error;
    }
  }

  /**
   * Unpin content (allow garbage collection)
   */
  async unpin(cid: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      await this.client!.pin.rm(cid);
      logger.info({ cid }, 'Content unpinned on IPFS');
    } catch (error) {
      logger.error({ error, cid }, 'Failed to unpin content');
      throw error;
    }
  }

  /**
   * List all pinned content
   */
  async listPinned(): Promise<string[]> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      const pins: string[] = [];
      for await (const pin of this.client!.pin.ls()) {
        pins.push(pin.cid.toString());
      }
      return pins;
    } catch (error) {
      logger.error({ error }, 'Failed to list pinned content');
      throw error;
    }
  }

  /**
   * Get node stats
   */
  async getStats(): Promise<{
    id: string;
    version: string;
    repoSize?: number;
    peers: number;
  }> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      const [id, stats, peers] = await Promise.all([
        this.client!.id(),
        this.client!.repo.stat(),
        this.client!.swarm.peers()
      ]);

      return {
        id: id.id.toString(),
        version: id.agentVersion,
        repoSize: Number(stats.repoSize),
        peers: peers.length
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get IPFS stats');
      throw error;
    }
  }

  /**
   * Check if content exists (without downloading)
   */
  async exists(cid: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      if (!this.CID) {
        throw new Error('CID not initialized');
      }
      const parsedCid = this.CID.parse(cid);
      const stats = await this.client!.object.stat(parsedCid, { timeout: 5000 });
      return stats !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload raw content (for testing or unencrypted data)
   */
  async uploadRaw(content: string | Buffer): Promise<IPFSContent> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      const result = await this.client!.add(content, {
        pin: true,
        cidVersion: 1
      });

      return {
        cid: result.cid.toString(),
        size: result.size,
        path: result.path
      };
    } catch (error) {
      logger.error({ error }, 'Failed to upload raw content');
      throw error;
    }
  }

  /**
   * Get content size without downloading
   */
  async getSize(cid: string): Promise<number> {
    if (!this.isConnected()) {
      throw new Error('IPFS not connected');
    }

    try {
      if (!this.CID) {
        throw new Error('CID not initialized');
      }
      const parsedCid = this.CID.parse(cid);
      const stats = await this.client!.object.stat(parsedCid);
      return stats.CumulativeSize;
    } catch (error) {
      logger.error({ error, cid }, 'Failed to get content size');
      throw error;
    }
  }

  /**
   * Validate CID format
   */
  isValidCID(cidString: string): boolean {
    try {
      if (!this.CID) {
        // If CID is not initialized, try to initialize it synchronously
        // This is a fallback for validation-only use cases
        return false;
      }
      this.CID.parse(cidString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from IPFS
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      // IPFS HTTP client doesn't need explicit disconnect
      this.client = null;
      this.connected = false;
      logger.info('Disconnected from IPFS');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      await this.client!.id();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();