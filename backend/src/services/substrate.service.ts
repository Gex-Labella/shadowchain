/**
 * Substrate Service for blockchain interactions
 * 
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { u8aToHex } from '@polkadot/util';
import config from '../config';
import { substrateLogger as logger } from '../utils/logger';

export interface ShadowItem {
  id: string;
  content: string;
  timestamp: number;
  source: 'GitHub' | 'Twitter';
  metadata: string;
  deleted: boolean;
}

export interface ConsentRecord {
  grantedAt: number;
  expiresAt?: number;
  messageHash: string;
}

export class SubstrateService {
  private api?: ApiPromise;
  private keyring: Keyring;
  private signerAccount?: KeyringPair;
  private isConnected: boolean = false;
  private connectionAttempted: boolean = false;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor() {
    this.keyring = new Keyring({ type: 'sr25519' });
  }

  /**
   * Initialize connection to Substrate node (non-blocking)
   * Will work gracefully if parachain is not available
   */
  async connect(): Promise<void> {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    try {
      logger.info({ url: config.substrateWsUrl }, 'Attempting to connect to Substrate parachain...');
      
      const provider = new WsProvider(config.substrateWsUrl);
      
      // Set a connection timeout
      const connectionPromise = ApiPromise.create({
        provider,
        types: {
          // Custom types for Shadow pallet to match runtime
          ShadowItem: {
            id: '[u8; 32]',
            content: 'Vec<u8>',
            timestamp: 'u64',
            source: 'u8',
            metadata: 'Vec<u8>'
          },
          ConsentRecord: {
            granted_at: 'BlockNumber',
            expires_at: 'Option<BlockNumber>',
            message_hash: 'Vec<u8>'
          },
          ...config.chainTypes
        }
        // Don't override signedExtensions - let the chain metadata determine them
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 second timeout
      });

      this.api = await Promise.race([connectionPromise, timeoutPromise]);
      await this.api.isReady;

      const chain = await this.api.rpc.system.chain();
      const nodeName = await this.api.rpc.system.name();
      const nodeVersion = await this.api.rpc.system.version();

      logger.info({
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
      }, 'Successfully connected to Substrate parachain');

      this.isConnected = true;
      this.connectionAttempted = true;

      // Set up reconnection handler
      provider.on('disconnected', () => {
        logger.warn('Substrate connection lost, will attempt reconnection');
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      this.connectionAttempted = true;
      this.isConnected = false;
      
      logger.warn({ 
        error: error instanceof Error ? error.message : String(error),
        url: config.substrateWsUrl 
      }, 'Substrate parachain not available - running in offline mode');
      
      // Schedule reconnection attempt
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Don't schedule if already scheduled
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      logger.info('Attempting to reconnect to Substrate parachain...');
      this.connect().catch(error => {
        logger.debug({ error }, 'Reconnection attempt failed');
      });
    }, 30000); // Retry every 30 seconds
  }

  /**
   * Disconnect from Substrate node
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.api) {
      await this.api.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Substrate parachain');
    }
  }

  /**
   * Check if connected to the parachain
   */
  isChainConnected(): boolean {
    return this.isConnected && this.api?.isConnected === true;
  }

  /**
   * Prepare a shadow item transaction for user signing
   * Returns the unsigned transaction data or null if chain is not available
   */
  async prepareShadowItemTx(
    userAddress: string,
    content: string,
    source: 'GitHub' | 'Twitter',
    metadata: string = ''
  ): Promise<{ method: string; args: any[] } | null> {
    if (!this.isChainConnected()) {
      logger.warn('Cannot prepare shadow item tx - parachain not connected.');
      return null;
    }

    if (!this.api) {
      logger.warn('API not initialized - cannot prepare transaction');
      return null;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.tx || !this.api.tx.shadow) {
        logger.warn('Shadow pallet not available on this chain - running in off-chain mode');
        return null;
      }
      
      // Check if the submitShadowItem method exists
      if (!this.api.tx.shadow.submitShadowItem) {
        logger.warn('submitShadowItem method not found in shadow pallet');
        return null;
      }
      
      // Inspect the submitShadowItem metadata to determine argument count
      const txMetadata = this.api.tx.shadow.submitShadowItem.meta;
      const argCount = txMetadata.args.length;
      const argNames = txMetadata.args.map(arg => arg.name.toString());
      
      logger.info({
        methodName: txMetadata.name.toString(),
        argCount,
        args: txMetadata.args.map(arg => ({
          name: arg.name.toString(),
          type: arg.type.toString()
        }))
      }, 'submitShadowItem metadata from chain');
      
      // Convert content to hex string for the blockchain
      const contentHex = u8aToHex(Buffer.from(JSON.stringify(content)));
      const metadataHex = u8aToHex(Buffer.from(metadata));
      const sourceValue = source === 'GitHub' ? 0 : 1;
      
      let extrinsic: any;
      
      // Dynamically handle different argument counts
      if (argCount === 4) {
        // Old chain version: (content, encrypted_key, source, metadata)
        // Check if second argument is 'encrypted_key' or similar
        const hasEncryptedKey = argNames[1].toLowerCase().includes('encrypt') ||
                                argNames[1].toLowerCase().includes('key');
        
        if (hasEncryptedKey) {
          logger.info({
            contentHex: contentHex.substring(0, 40) + '...',
            encryptedKey: '0x (empty)',
            source: sourceValue,
            metadataHex: metadataHex.substring(0, 40) + '...'
          }, 'Sending to blockchain with 4 arguments (including empty encrypted_key for compatibility)');
          
          // Pass empty encrypted key as second argument
          extrinsic = this.api.tx.shadow.submitShadowItem(
            contentHex,
            '0x',  // Empty encrypted key for compatibility
            sourceValue,
            metadataHex
          );
        } else {
          // Different 4-argument structure, adjust accordingly
          logger.warn('Unexpected 4-argument structure, attempting with default order');
          extrinsic = this.api.tx.shadow.submitShadowItem(
            contentHex,
            sourceValue,
            metadataHex,
            '0x'  // Empty fourth argument
          );
        }
      } else if (argCount === 3) {
        // New chain version: (content, source, metadata)
        logger.info({
          contentHex: contentHex.substring(0, 40) + '...',
          source: sourceValue,
          metadataHex: metadataHex.substring(0, 40) + '...'
        }, 'Sending to blockchain with 3 arguments');
        
        extrinsic = this.api.tx.shadow.submitShadowItem(
          contentHex,
          sourceValue,
          metadataHex
        );
      } else {
        // Unexpected number of arguments
        logger.error({
          expectedArgs: 'either 3 or 4',
          actualArgs: argCount,
          argNames
        }, 'Unexpected number of arguments for submitShadowItem');
        throw new Error(`Unexpected argument count for submitShadowItem: ${argCount}`);
      }

      // Return the unsigned transaction data
      return {
        method: extrinsic.method.toHex(),
        args: [
          content,
          source === 'GitHub' ? 0 : 1, // Convert to u8 for the args as well
          metadata
        ]
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        userAddress,
        content: content.substring(0, 50) + '...',
        source
      }, 'Failed to prepare shadow item transaction');
      return null;
    }
  }


  /**
   * Get shadow items for an account
   * Returns empty array if chain is not available
   */
  async getShadowItems(address: string): Promise<ShadowItem[]> {
    if (!this.isChainConnected() || !this.api) {
      logger.debug('Cannot get shadow items - parachain not connected');
      return [];
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.query.shadow) {
        logger.debug('Shadow pallet not available on this chain');
        return [];
      }
      
      const items = await this.api.query.shadow.shadowItems(address);
      const itemsArray = items.toJSON() as any[];

      return itemsArray.map(item => {
        // Log what we're getting from blockchain
        logger.info({
          itemId: item.id,
          contentLength: item.content?.length || 0,
          contentType: typeof item.content
        }, 'Raw item from blockchain');
        
        // Handle content conversion
        let contentStr: string;
        if (Array.isArray(item.content)) {
          // If it's an array, convert to string
          contentStr = Buffer.from(item.content).toString('utf8');
          try {
            // Try to parse as JSON if it looks like stringified JSON
            const parsed = JSON.parse(contentStr);
            contentStr = parsed;
          } catch {
            // If not JSON, keep as string
          }
        } else if (typeof item.content === 'string') {
          contentStr = item.content;
        } else {
          // Try to convert whatever format it is
          contentStr = Buffer.from(item.content).toString('utf8');
        }
        
        // Convert timestamp from blockchain format to milliseconds
        // Blockchain stores as Unix timestamp in seconds, we need milliseconds
        const timestampMs = typeof item.timestamp === 'number'
          ? item.timestamp * 1000  // Convert seconds to milliseconds
          : parseInt(item.timestamp.toString()) * 1000;
        
        return {
          id: item.id,
          content: contentStr,
          timestamp: timestampMs,
          source: item.source as 'GitHub' | 'Twitter', // Already a string from the enum
          metadata: Buffer.from(item.metadata).toString(),
          deleted: item.deleted || false,
        };
      });
    } catch (error) {
      logger.error({ error, address }, 'Failed to get shadow items from parachain');
      return [];
    }
  }

  /**
   * Get active (non-deleted) shadow items
   */
  async getActiveShadowItems(address: string): Promise<ShadowItem[]> {
    const items = await this.getShadowItems(address);
    return items.filter(item => !item.deleted);
  }

  /**
   * Check if account has valid consent
   * Returns false if chain is not available (safe default)
   */
  async hasValidConsent(address: string): Promise<boolean> {
    if (!this.isChainConnected() || !this.api) {
      logger.debug('Cannot check consent - parachain not connected');
      return false;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.query.shadow) {
        logger.debug('Shadow pallet not available on this chain');
        return false;
      }
      
      const consent = await this.api.query.shadow.consentRecords(address);
      
      if (consent.isEmpty) {
        return false;
      }

      const consentRecord = consent.toJSON() as any;
      
      if (consentRecord.expiresAt) {
        // Get current block number
        const currentBlock = await this.api.query.system.number();
        return parseInt(currentBlock.toString()) <= consentRecord.expiresAt;
      }

      return true;
    } catch (error) {
      logger.error({ error, address }, 'Failed to check consent on parachain');
      return false;
    }
  }

  /**
   * Get consent record
   */
  async getConsentRecord(address: string): Promise<ConsentRecord | null> {
    if (!this.isChainConnected() || !this.api) {
      return null;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.query.shadow) {
        logger.debug('Shadow pallet not available on this chain');
        return null;
      }
      
      const consent = await this.api.query.shadow.consentRecords(address);
      
      if (consent.isEmpty) {
        return null;
      }

      const record = consent.toJSON() as any;
      
      return {
        grantedAt: record.grantedAt,
        expiresAt: record.expiresAt,
        messageHash: u8aToHex(record.messageHash),
      };
    } catch (error) {
      logger.error({ error, address }, 'Failed to get consent record from parachain');
      return null;
    }
  }

  /**
   * Grant consent for the backend to submit shadow items
   */
  async grantConsent(
    userAddress: string,
    messageHash: string,
    duration?: number
  ): Promise<string | null> {
    if (!this.isChainConnected() || !this.api) {
      logger.warn('Cannot grant consent - parachain not connected');
      return null;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.tx.shadow) {
        logger.error('Shadow pallet not available on this chain');
        return null;
      }
      
      // Create extrinsic
      const extrinsic = this.api.tx.shadow.grantConsent(
        messageHash, // Pass as string, will be converted by the API
        duration
      );

      // Submit extrinsic
      const hash = await this.submitExtrinsic(extrinsic, userAddress);
      
      logger.info({
        userAddress,
        messageHash,
        duration,
        hash,
      }, 'Consent granted on parachain');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to grant consent on parachain');
      return null;
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userAddress: string): Promise<string | null> {
    if (!this.isChainConnected() || !this.api) {
      logger.warn('Cannot revoke consent - parachain not connected');
      return null;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.tx.shadow) {
        logger.error('Shadow pallet not available on this chain');
        return null;
      }
      
      // Create extrinsic
      const extrinsic = this.api.tx.shadow.revokeConsent();

      // Submit extrinsic
      const hash = await this.submitExtrinsic(extrinsic, userAddress);
      
      logger.info({
        userAddress,
        hash,
      }, 'Consent revoked on parachain');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to revoke consent on parachain');
      return null;
    }
  }

  /**
   * Submit extrinsic with proper error handling
   */
  private async submitExtrinsic(
    extrinsic: SubmittableExtrinsic<'promise'>,
    userAddress?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let unsub: (() => void) | undefined;

      // Determine signer
      const signer = this.signerAccount || this.keyring.addFromUri('//Alice'); // Fallback for testing

      // Handle extrinsic status
      extrinsic.signAndSend(
        signer,
        { nonce: -1 },
        (result) => {
          logger.debug({ status: result.status.toJSON() }, 'Extrinsic status');

          if (result.status.isInBlock) {
            logger.info({
              blockHash: result.status.asInBlock.toHex(),
            }, 'Extrinsic included in block');
          }

          if (result.status.isFinalized) {
            const hash = result.status.asFinalized.toHex();
            logger.info({ hash }, 'Extrinsic finalized');

            // Check for errors
            result.events.forEach(({ event }) => {
              if (this.api?.events.system.ExtrinsicFailed.is(event)) {
                const [error] = event.data;
                logger.error({ error: error.toJSON() }, 'Extrinsic failed');
                if (unsub) unsub();
                reject(new Error('Extrinsic failed'));
                return;
              }
            });

            if (unsub) unsub();
            resolve(hash);
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      }).catch((error) => {
        logger.error({ error }, 'Failed to submit extrinsic');
        reject(error);
      });
    });
  }

  /**
   * Get chain metadata
   */
  async getChainInfo(): Promise<any> {
    if (!this.isChainConnected() || !this.api) {
      return {
        connected: false,
        message: 'Parachain not connected'
      };
    }

    try {
      const [chain, nodeName, nodeVersion, health] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.name(),
        this.api.rpc.system.version(),
        this.api.rpc.system.health(),
      ]);

      return {
        connected: true,
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
        peers: health.peers.toNumber(),
        isSyncing: health.isSyncing.isTrue,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get chain info');
      return {
        connected: false,
        error: 'Failed to get chain info'
      };
    }
  }

  /**
   * Get chain height (current block number)
   */
  async getChainHeight(): Promise<number> {
    if (!this.isChainConnected() || !this.api) {
      return 0;
    }

    try {
      const currentBlock = await this.api.query.system.number();
      return parseInt(currentBlock.toString());
    } catch (error) {
      logger.error({ error }, 'Failed to get chain height');
      return 0;
    }
  }

  /**
   * Get last block time
   */
  async getLastBlockTime(): Promise<Date | null> {
    if (!this.isChainConnected() || !this.api) {
      return null;
    }

    try {
      // Get the latest block hash
      const lastBlockHash = await this.api.rpc.chain.getBlockHash();
      // Get the block
      const block = await this.api.rpc.chain.getBlock(lastBlockHash);
      
      // Try to extract timestamp from extrinsics
      const extrinsics = block.block.extrinsics;
      for (const ext of extrinsics) {
        // Check if this is a timestamp.set extrinsic
        if (ext.method.section === 'timestamp' && ext.method.method === 'set') {
          const timestamp = ext.args[0];
          return new Date(parseInt(timestamp.toString()));
        }
      }
      
      // If no timestamp found, return current time as approximation
      return new Date();
    } catch (error) {
      logger.error({ error }, 'Failed to get last block time');
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.api || !this.api.isConnected) {
      return false;
    }

    try {
      await this.api.rpc.system.health();
      return true;
    } catch (error) {
      logger.debug({ error }, 'Substrate health check failed');
      return false;
    }
  }

  /**
   * Subscribe to new shadow items for an account
   */
  async subscribeShadowItems(
    address: string,
    callback: (items: ShadowItem[]) => void
  ): Promise<(() => void) | null> {
    if (!this.isChainConnected() || !this.api) {
      logger.debug('Cannot subscribe to shadow items - parachain not connected');
      return null;
    }

    try {
      // Check if shadow pallet exists
      if (!this.api.query.shadow) {
        logger.debug('Shadow pallet not available on this chain');
        return null;
      }
      
      const unsub = await this.api.query.shadow.shadowItems(
        address,
        (items: any) => {
          const itemsArray = items.toJSON() as any[];
          const shadowItems: ShadowItem[] = itemsArray.map(item => {
            // Convert timestamp from blockchain format to milliseconds
            const timestampMs = typeof item.timestamp === 'number' 
              ? item.timestamp * 1000  // Convert seconds to milliseconds
              : parseInt(item.timestamp.toString()) * 1000;
            
            return {
              id: item.id,
              content: Buffer.from(item.content).toString('utf8'),
              timestamp: timestampMs,
              source: item.source as 'GitHub' | 'Twitter', // Already a string from the enum
              metadata: Buffer.from(item.metadata).toString(),
              deleted: item.deleted || false,
            };
          });
          callback(shadowItems);
        }
      );

      return unsub as unknown as (() => void);
    } catch (error) {
      logger.error({ error }, 'Failed to subscribe to shadow items');
      return null;
    }
  }
}

// Export singleton instance
export const substrateService = new SubstrateService();