/**
 * IPFS Service for content storage and retrieval
 */

import { create, IPFSHTTPClient } from 'ipfs-http-client';
import axios from 'axios';
import config from '../config';
import { ipfsLogger as logger } from '../utils/logger';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  pinned: boolean;
}

export class IPFSService {
  private client: IPFSHTTPClient;
  private pinningClient?: any;

  constructor() {
    // Initialize IPFS HTTP client
    this.client = create({
      url: config.ipfsApiUrl,
    });

    // Initialize pinning service client if not local
    this.initializePinningService();
  }

  private initializePinningService(): void {
    switch (config.pinningService) {
      case 'web3storage':
        // Web3.storage implementation would go here
        logger.info('Using Web3.storage for pinning');
        break;
      case 'pinata':
        // Pinata implementation would go here
        logger.info('Using Pinata for pinning');
        break;
      default:
        logger.info('Using local IPFS pinning');
    }
  }

  /**
   * Upload content to IPFS
   */
  async upload(content: Buffer | string): Promise<IPFSUploadResult> {
    try {
      const startTime = Date.now();
      
      // Add content to IPFS
      const result = await this.client.add(content, {
        pin: config.pinningService === 'local',
      });

      const cid = result.cid.toString();
      const size = result.size;

      logger.info({
        cid,
        size,
        duration: Date.now() - startTime,
      }, 'Content uploaded to IPFS');

      // Pin to remote service if configured
      let pinned = config.pinningService === 'local';
      if (config.pinningService !== 'local') {
        pinned = await this.pinToRemote(cid);
      }

      return { cid, size, pinned };
    } catch (error) {
      logger.error({ error }, 'Failed to upload to IPFS');
      throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve content from IPFS
   */
  async retrieve(cid: string): Promise<Buffer> {
    try {
      const startTime = Date.now();
      const chunks: Uint8Array[] = [];

      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }

      const content = Buffer.concat(chunks);

      logger.info({
        cid,
        size: content.length,
        duration: Date.now() - startTime,
      }, 'Content retrieved from IPFS');

      return content;
    } catch (error) {
      logger.error({ error, cid }, 'Failed to retrieve from IPFS');
      throw new Error(`IPFS retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pin content to remote pinning service
   */
  private async pinToRemote(cid: string): Promise<boolean> {
    try {
      switch (config.pinningService) {
        case 'web3storage':
          return await this.pinToWeb3Storage(cid);
        case 'pinata':
          return await this.pinToPinata(cid);
        default:
          return true;
      }
    } catch (error) {
      logger.error({ error, cid }, 'Failed to pin to remote service');
      return false;
    }
  }

  /**
   * Pin to Web3.storage
   */
  private async pinToWeb3Storage(cid: string): Promise<boolean> {
    if (!config.web3StorageToken) {
      throw new Error('Web3.storage token not configured');
    }

    try {
      // In a real implementation, you would use the Web3.storage client
      // For now, we'll simulate the API call
      const response = await axios.post(
        'https://api.web3.storage/pins',
        { cid },
        {
          headers: {
            'Authorization': `Bearer ${config.web3StorageToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error({ error, cid }, 'Web3.storage pinning failed');
      return false;
    }
  }

  /**
   * Pin to Pinata
   */
  private async pinToPinata(cid: string): Promise<boolean> {
    if (!config.pinataApiKey || !config.pinataSecretKey) {
      throw new Error('Pinata credentials not configured');
    }

    try {
      // In a real implementation, you would use the Pinata SDK
      // For now, we'll simulate the API call
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinByHash',
        {
          hashToPin: cid,
          pinataMetadata: {
            name: `shadowchain-${cid}`,
          },
        },
        {
          headers: {
            'pinata_api_key': config.pinataApiKey,
            'pinata_secret_api_key': config.pinataSecretKey,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error({ error, cid }, 'Pinata pinning failed');
      return false;
    }
  }

  /**
   * Check if content is pinned
   */
  async isPinned(cid: string): Promise<boolean> {
    try {
      const pins = this.client.pin.ls({ paths: [cid] });
      
      for await (const pin of pins) {
        if (pin.cid.toString() === cid) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error({ error, cid }, 'Failed to check pin status');
      return false;
    }
  }

  /**
   * Unpin content (best effort)
   */
  async unpin(cid: string): Promise<boolean> {
    try {
      await this.client.pin.rm(cid);
      logger.info({ cid }, 'Content unpinned from IPFS');
      return true;
    } catch (error) {
      logger.error({ error, cid }, 'Failed to unpin from IPFS');
      return false;
    }
  }

  /**
   * Get IPFS node info
   */
  async getNodeInfo(): Promise<any> {
    try {
      const id = await this.client.id();
      const version = await this.client.version();
      
      return {
        id: id.id,
        addresses: id.addresses,
        version: version.version
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get IPFS node info');
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.version();
      return true;
    } catch (error) {
      logger.error({ error }, 'IPFS health check failed');
      return false;
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();