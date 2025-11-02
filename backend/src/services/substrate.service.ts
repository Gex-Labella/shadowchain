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
  cid: string;
  encryptedKey: string;
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
        types: config.chainTypes,
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

      // Initialize signer if backend signer key is provided
      if (process.env.BACKEND_SIGNER_PRIVATE_KEY) {
        this.signerAccount = this.keyring.addFromUri(process.env.BACKEND_SIGNER_PRIVATE_KEY);
        logger.info({ address: this.signerAccount.address }, 'Backend signer initialized');
      }

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
   * Submit a shadow item to the chain
   * Returns null if chain is not available (graceful degradation)
   */
  async submitShadowItem(
    userAddress: string,
    cid: string,
    encryptedKey: Uint8Array,
    source: 'GitHub' | 'Twitter',
    metadata: string = ''
  ): Promise<string | null> {
    if (!this.isChainConnected()) {
      logger.warn('Cannot submit shadow item - parachain not connected. Item will be stored off-chain only.');
      return null;
    }

    if (!this.api) {
      return null;
    }

    try {
      // Create extrinsic
      // Convert source to numeric value (0 = GitHub, 1 = Twitter)
      const sourceValue = source === 'GitHub' ? 0 : 1;
      
      const extrinsic = this.api.tx.shadow.submitShadowItem(
        Array.from(Buffer.from(cid)),
        Array.from(encryptedKey),
        sourceValue,
        Array.from(Buffer.from(metadata))
      );

      // Submit extrinsic
      const hash = await this.submitExtrinsic(extrinsic, userAddress);
      
      logger.info({
        userAddress,
        cid,
        source,
        hash,
      }, 'Shadow item submitted to parachain');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to submit shadow item to parachain');
      // Return null instead of throwing - graceful degradation
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
      const items = await this.api.query.shadow.shadowItems(address);
      const itemsArray = items.toJSON() as any[];

      return itemsArray.map(item => ({
        id: item.id,
        cid: Buffer.from(item.cid).toString(),
        encryptedKey: u8aToHex(item.encryptedKey),
        timestamp: item.timestamp,
        source: item.source === 0 ? 'GitHub' : 'Twitter',
        metadata: Buffer.from(item.metadata).toString(),
        deleted: false,
      }));
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
      // Create extrinsic
      const extrinsic = this.api.tx.shadow.grantConsent(
        Array.from(Buffer.from(messageHash)),
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
      const unsub = await this.api.query.shadow.shadowItems(
        address,
        (items: any) => {
          const itemsArray = items.toJSON() as any[];
          const shadowItems: ShadowItem[] = itemsArray.map(item => ({
            id: item.id,
            cid: Buffer.from(item.cid).toString(),
            encryptedKey: u8aToHex(item.encryptedKey),
            timestamp: item.timestamp,
            source: item.source === 0 ? 'GitHub' : 'Twitter',
            metadata: Buffer.from(item.metadata).toString(),
            deleted: false,
          }));
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