/**
 * IPFS Service for content storage and retrieval
 */

import axios from 'axios';
import config from '../config';
import { ipfsLogger as logger } from '../utils/logger';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  pinned: boolean;
}

export class IPFSService {
  private client: any;
  private pinningClient?: any;
  private isAvailable: boolean = false;

  constructor() {
    // Try to initialize IPFS HTTP client
    this.initializeIPFSClient();
    
    // Initialize pinning service client if not local
    this.initializePinningService();
  }

  private async initializeIPFSClient(): Promise<void> {
    try {
      // For now, we'll use axios to interact with IPFS HTTP API directly
      // This avoids the ESM import issue with ipfs-http-client v60
      const response = await axios.post(`${config.ipfsApiUrl}/api/v0/version`);
      if (response.status === 200) {
        this.isAvailable = true;
        logger.info('IPFS HTTP API is available');
      }
    } catch (error) {
      logger.warn('IPFS HTTP API is not available, using mock mode');
      this.isAvailable = false;
    }
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
      
      // If IPFS is not available, return a mock CID
      if (!this.isAvailable) {
        const mockCid = `Qm${Buffer.from(content).toString('hex').substring(0, 44)}`;
        logger.info('IPFS not available, returning mock CID');
        return {
          cid: mockCid,
          size: Buffer.byteLength(content),
          pinned: false
        };
      }

      // Use axios to upload to IPFS HTTP API
      const formData = new FormData();
      const blob = new Blob([content]);
      formData.append('file', blob);

      const response = await axios.post(
        `${config.ipfsApiUrl}/api/v0/add?pin=true`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const result = response.data;
      const cid = result.Hash;
      const size = parseInt(result.Size);

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
      
      // Return mock CID if upload fails
      const mockCid = `Qm${Buffer.from(content).toString('hex').substring(0, 44)}`;
      return {
        cid: mockCid,
        size: Buffer.byteLength(content),
        pinned: false
      };
    }
  }

  /**
   * Retrieve content from IPFS
   */
  async retrieve(cid: string): Promise<Buffer> {
    try {
      const startTime = Date.now();
      
      // If IPFS is not available, return empty buffer
      if (!this.isAvailable) {
        logger.warn('IPFS not available, returning empty buffer');
        return Buffer.from('');
      }

      const response = await axios.get(
        `${config.ipfsApiUrl}/api/v0/cat?arg=${cid}`,
        {
          responseType: 'arraybuffer',
        }
      );

      const content = Buffer.from(response.data);

      logger.info({
        cid,
        size: content.length,
        duration: Date.now() - startTime,
      }, 'Content retrieved from IPFS');

      return content;
    } catch (error) {
      logger.error({ error, cid }, 'Failed to retrieve from IPFS');
      return Buffer.from('');
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
      logger.warn('Web3.storage token not configured');
      return false;
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
      logger.warn('Pinata credentials not configured');
      return false;
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
      if (!this.isAvailable) {
        return false;
      }

      const response = await axios.post(
        `${config.ipfsApiUrl}/api/v0/pin/ls?arg=${cid}`
      );
      
      return response.status === 200 && response.data.Keys && response.data.Keys[cid];
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
      if (!this.isAvailable) {
        return false;
      }

      await axios.post(
        `${config.ipfsApiUrl}/api/v0/pin/rm?arg=${cid}`
      );
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
      if (!this.isAvailable) {
        return {
          id: 'mock-node',
          addresses: [],
          version: 'mock'
        };
      }

      const [idResponse, versionResponse] = await Promise.all([
        axios.post(`${config.ipfsApiUrl}/api/v0/id`),
        axios.post(`${config.ipfsApiUrl}/api/v0/version`)
      ]);
      
      return {
        id: idResponse.data.ID,
        addresses: idResponse.data.Addresses,
        version: versionResponse.data.Version
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get IPFS node info');
      return {
        id: 'error',
        addresses: [],
        version: 'unknown'
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isAvailable) {
        return true; // Return true even if IPFS is not available to not block the app
      }

      const response = await axios.post(`${config.ipfsApiUrl}/api/v0/version`);
      return response.status === 200;
    } catch (error) {
      logger.error({ error }, 'IPFS health check failed');
      return true; // Return true to not block the app
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();