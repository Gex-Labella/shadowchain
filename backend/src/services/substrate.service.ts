/**
 * Substrate Service for blockchain interactions
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

  constructor() {
    this.keyring = new Keyring({ type: 'sr25519' });
  }

  /**
   * Initialize connection to Substrate node
   */
  async connect(): Promise<void> {
    try {
      const provider = new WsProvider(config.substrateWsUrl);
      
      this.api = await ApiPromise.create({
        provider,
        types: config.chainTypes,
      });

      await this.api.isReady;

      const chain = await this.api.rpc.system.chain();
      const nodeName = await this.api.rpc.system.name();
      const nodeVersion = await this.api.rpc.system.version();

      logger.info({
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
      }, 'Connected to Substrate node');

      // Initialize signer if backend signer key is provided
      if (process.env.BACKEND_SIGNER_PRIVATE_KEY) {
        this.signerAccount = this.keyring.addFromUri(process.env.BACKEND_SIGNER_PRIVATE_KEY);
        logger.info({ address: this.signerAccount.address }, 'Backend signer initialized');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Substrate node');
      throw error;
    }
  }

  /**
   * Disconnect from Substrate node
   */
  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      logger.info('Disconnected from Substrate node');
    }
  }

  /**
   * Submit a shadow item to the chain
   */
  async submitShadowItem(
    userAddress: string,
    cid: string,
    encryptedKey: Uint8Array,
    source: 'GitHub' | 'Twitter',
    metadata: string = ''
  ): Promise<string> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
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
      }, 'Shadow item submitted');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to submit shadow item');
      throw error;
    }
  }

  /**
   * Get shadow items for an account
   */
  async getShadowItems(address: string): Promise<ShadowItem[]> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
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
        deleted: false, // No deletion flag in current implementation
      }));
    } catch (error) {
      logger.error({ error, address }, 'Failed to get shadow items');
      throw error;
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
   */
  async hasValidConsent(address: string): Promise<boolean> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
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
      logger.error({ error, address }, 'Failed to check consent');
      return false;
    }
  }

  /**
   * Get consent record
   */
  async getConsentRecord(address: string): Promise<ConsentRecord | null> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
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
      logger.error({ error, address }, 'Failed to get consent record');
      throw error;
    }
  }

  /**
   * Grant consent for the backend to submit shadow items
   */
  async grantConsent(
    userAddress: string,
    messageHash: string,
    duration?: number
  ): Promise<string> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
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
      }, 'Consent granted');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to grant consent');
      throw error;
    }
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userAddress: string): Promise<string> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
    }

    try {
      // Create extrinsic
      const extrinsic = this.api.tx.shadow.revokeConsent();

      // Submit extrinsic
      const hash = await this.submitExtrinsic(extrinsic, userAddress);
      
      logger.info({
        userAddress,
        hash,
      }, 'Consent revoked');

      return hash;
    } catch (error) {
      logger.error({ error }, 'Failed to revoke consent');
      throw error;
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
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
    }

    const [chain, nodeName, nodeVersion, health] = await Promise.all([
      this.api.rpc.system.chain(),
      this.api.rpc.system.name(),
      this.api.rpc.system.version(),
      this.api.rpc.system.health(),
    ]);

    return {
      chain: chain.toString(),
      nodeName: nodeName.toString(),
      nodeVersion: nodeVersion.toString(),
      peers: health.peers.toNumber(),
      isSyncing: health.isSyncing.isTrue,
    };
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
      logger.error({ error }, 'Substrate health check failed');
      return false;
    }
  }

  /**
   * Subscribe to new shadow items for an account
   */
  async subscribeShadowItems(
    address: string,
    callback: (items: ShadowItem[]) => void
  ): Promise<() => void> {
    if (!this.api) {
      throw new Error('Not connected to Substrate node');
    }

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
          deleted: false, // No deletion flag in current implementation
        }));
        callback(shadowItems);
      }
    );

    return unsub as unknown as (() => void);
  }
}

// Export singleton instance
export const substrateService = new SubstrateService();