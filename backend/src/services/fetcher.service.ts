/**
 * Fetcher Service - Orchestrates data fetching, encryption, and storage
 */

import cron from 'node-cron';
import { hexToU8a } from '@polkadot/util';
import * as crypto from '../../../shared-crypto/dist';
import config from '../config';
import { fetcherLogger as logger } from '../utils/logger';
import { githubService, GitHubContent } from './github.service';
import { twitterService, TwitterContent } from './twitter.service';
import { ipfsService, IPFSUploadResult } from './ipfs.service';
import { substrateService } from './substrate.service';
import { oauthService } from './oauth.service';

type ContentItem = GitHubContent | TwitterContent;

export interface ProcessedItem {
  source: 'github' | 'twitter';
  originalUrl: string;
  ipfsCid: string;
  encryptedKey: string;
  timestamp: number;
  txHash?: string;
}

export class FetcherService {
  private cronJob?: cron.ScheduledTask;
  private isRunning: boolean = false;
  private lastSyncTime: Map<string, Date> = new Map();
  private servicesAvailable = {
    github: false,
    twitter: false,
    substrate: false,
    ipfs: false
  };

  /**
   * Start the fetcher service
   */
  async start(): Promise<void> {
    logger.info('Starting fetcher service');

    // Initialize services (but don't fail if some are unavailable)
    await this.initializeServices();

    // Only start cron job if at least some services are available
    if (Object.values(this.servicesAvailable).some(v => v)) {
      // Start cron job
      const schedule = `*/${config.fetchIntervalMinutes} * * * *`;
      this.cronJob = cron.schedule(schedule, () => {
        this.runSync().catch(error => {
          logger.error({ error }, 'Sync failed');
        });
      });

      logger.info({ schedule, availableServices: this.servicesAvailable }, 'Fetcher service started');

      // Run initial sync if all required services are available
      if (this.servicesAvailable.substrate && this.servicesAvailable.ipfs && 
          (this.servicesAvailable.github || this.servicesAvailable.twitter)) {
        await this.runSync();
      }
    } else {
      logger.warn('No external services available, fetcher service running in limited mode');
    }
  }

  /**
   * Stop the fetcher service
   */
  async stop(): Promise<void> {
    logger.info('Stopping fetcher service');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    if (this.servicesAvailable.substrate) {
      await substrateService.disconnect();
    }
    
    logger.info('Fetcher service stopped');
  }

  /**
   * Initialize required services
   */
  private async initializeServices(): Promise<void> {
    // Try to connect to Substrate
    try {
      await substrateService.connect();
      this.servicesAvailable.substrate = true;
      logger.info('Substrate connection successful');
    } catch (error) {
      logger.warn({ error }, 'Substrate connection failed - will run without blockchain');
      this.servicesAvailable.substrate = false;
    }

    // Validate API tokens
    if (config.githubToken) {
      try {
        const githubValid = await githubService.validateToken();
        this.servicesAvailable.github = githubValid;
        logger.info({ valid: githubValid }, 'GitHub token validation');
      } catch (error) {
        logger.warn({ error }, 'GitHub token validation failed');
        this.servicesAvailable.github = false;
      }
    } else {
      logger.info('GitHub token not configured - GitHub fetching disabled');
      this.servicesAvailable.github = false;
    }

    if (config.twitterBearerToken) {
      try {
        const twitterValid = await twitterService.validateToken();
        this.servicesAvailable.twitter = twitterValid;
        logger.info({ valid: twitterValid }, 'Twitter token validation');
      } catch (error) {
        logger.warn({ error }, 'Twitter token validation failed');
        this.servicesAvailable.twitter = false;
      }
    } else {
      logger.info('Twitter token not configured - Twitter fetching disabled');
      this.servicesAvailable.twitter = false;
    }

    // Check IPFS connection
    try {
      const ipfsHealthy = await ipfsService.healthCheck();
      this.servicesAvailable.ipfs = ipfsHealthy;
      logger.info({ healthy: ipfsHealthy }, 'IPFS health check');
    } catch (error) {
      logger.warn({ error }, 'IPFS health check failed');
      this.servicesAvailable.ipfs = false;
    }

    logger.info({ availableServices: this.servicesAvailable }, 'Service initialization complete');
  }

  /**
   * Run a sync cycle
   */
  async runSync(): Promise<ProcessedItem[]> {
    if (this.isRunning) {
      logger.warn('Sync already in progress, skipping');
      return [];
    }

    // Check if we have minimum required services
    if (!this.servicesAvailable.substrate || !this.servicesAvailable.ipfs) {
      logger.warn('Cannot run sync - Substrate or IPFS not available');
      return [];
    }

    if (!this.servicesAvailable.github && !this.servicesAvailable.twitter) {
      logger.warn('Cannot run sync - No content sources available');
      return [];
    }

    this.isRunning = true;
    const processedItems: ProcessedItem[] = [];

    try {
      logger.info('Starting sync cycle');

      // Get all users with valid consent
      const usersWithConsent = await this.getUsersWithConsent();
      
      for (const userAddress of usersWithConsent) {
        try {
          const items = await this.syncUserData(userAddress);
          processedItems.push(...items);
        } catch (error) {
          logger.error({ error, userAddress }, 'Failed to sync user data');
        }
      }

      logger.info({ 
        processedCount: processedItems.length,
        users: usersWithConsent.length 
      }, 'Sync cycle completed');

    } catch (error) {
      logger.error({ error }, 'Sync cycle failed');
    } finally {
      this.isRunning = false;
    }

    return processedItems;
  }

  /**
   * Sync data for a specific user
   */
  async syncUserData(userAddress: string): Promise<ProcessedItem[]> {
    logger.info({ userAddress }, 'Syncing user data');

    // Get user's encryption key
    const userPublicKey = await this.getUserPublicKey(userAddress);
    if (!userPublicKey) {
      throw new Error('User public key not found');
    }

    // Get last sync time for this user
    const lastSync = this.lastSyncTime.get(userAddress);
    
    // Check if user has connected GitHub account
    const hasGitHubToken = await oauthService.hasValidGitHubToken(userAddress);
    
    // Fetch new content
    let githubContent: GitHubContent[] = [];
    let twitterContent: TwitterContent[] = [];
    
    if (this.servicesAvailable.github) {
      if (hasGitHubToken) {
        // Use user's OAuth token
        const userToken = await oauthService.getToken(userAddress, 'github');
        if (userToken) {
          githubContent = await githubService.fetchRecentCommitsWithToken(
            userToken.accessToken,
            lastSync
          );
        }
      } else {
        // Fallback to centralized approach if configured
        if (config.githubToken) {
          githubContent = await githubService.fetchRecentCommits(lastSync);
        }
      }
    }
    
    if (this.servicesAvailable.twitter) {
      // Twitter still uses centralized approach for now
      twitterContent = await twitterService.fetchRecentTweets(lastSync);
    }

    const allContent: ContentItem[] = [...githubContent, ...twitterContent];
    const processedItems: ProcessedItem[] = [];

    // Process each content item
    for (const content of allContent.slice(0, config.maxItemsPerSync)) {
      try {
        const processed = await this.processContentItem(content, userAddress, userPublicKey);
        processedItems.push(processed);
      } catch (error) {
        logger.error({ error, content }, 'Failed to process content item');
      }
    }

    // Update last sync time
    this.lastSyncTime.set(userAddress, new Date());

    return processedItems;
  }

  /**
   * Process a single content item
   */
  private async processContentItem(
    content: ContentItem,
    userAddress: string,
    userPublicKey: Uint8Array
  ): Promise<ProcessedItem> {
    // Encrypt content
    const { encryptedContent, encryptedKey } = await crypto.encryptContent(
      content,
      userPublicKey
    );

    // Serialize encrypted content
    const serializedContent = crypto.serializeEncryptedPayload(encryptedContent);

    // Upload to IPFS
    const ipfsResult = await ipfsService.upload(serializedContent);

    // Submit to blockchain
    let txHash: string | undefined;
    if (this.servicesAvailable.substrate) {
      txHash = await substrateService.submitShadowItem(
        userAddress,
        ipfsResult.cid,
        encryptedKey.ciphertext,
        content.source === 'github' ? 'GitHub' : 'Twitter',
        JSON.stringify({ 
          timestamp: content.timestamp,
          url: content.url 
        })
      );
    }

    const processed: ProcessedItem = {
      source: content.source,
      originalUrl: content.url,
      ipfsCid: ipfsResult.cid,
      encryptedKey: crypto.serializeEncryptedPayload(encryptedKey),
      timestamp: content.timestamp,
      txHash,
    };

    logger.info({ 
      userAddress,
      source: content.source,
      cid: ipfsResult.cid,
      txHash 
    }, 'Content item processed');

    return processed;
  }

  /**
   * Get users with valid consent
   * In a real implementation, this would query the chain for all users with consent
   * For now, we'll use a simplified approach
   */
  private async getUsersWithConsent(): Promise<string[]> {
    // This is a placeholder - in production, you'd query the chain
    // for all accounts with valid consent records
    const configuredUsers = process.env.SHADOW_USERS?.split(',') || [];
    
    if (!this.servicesAvailable.substrate) {
      // If substrate isn't available, return empty array
      return [];
    }
    
    const validUsers: string[] = [];
    
    for (const user of configuredUsers) {
      const hasConsent = await substrateService.hasValidConsent(user.trim());
      if (hasConsent) {
        validUsers.push(user.trim());
      }
    }

    return validUsers;
  }

  /**
   * Get user's public encryption key
   * In a real implementation, this would be stored on-chain or derived
   */
  private async getUserPublicKey(userAddress: string): Promise<Uint8Array | null> {
    // This is a placeholder - in production, you'd:
    // 1. Get the user's encryption public key from on-chain storage
    // 2. Or derive it from their account if using a deterministic scheme
    
    // For demo purposes, we'll use a test key
    const testKey = hexToU8a('0x' + '1'.repeat(64));
    return testKey;
  }

  /**
   * Manual sync for a specific user
   */
  async syncUser(userAddress: string): Promise<ProcessedItem[]> {
    if (!this.servicesAvailable.substrate) {
      throw new Error('Substrate service not available');
    }

    // Check consent
    const hasConsent = await substrateService.hasValidConsent(userAddress);
    if (!hasConsent) {
      throw new Error('User does not have valid consent');
    }

    return this.syncUserData(userAddress);
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isRunning: boolean;
    lastSyncTimes: Record<string, Date>;
    nextRunTime?: Date;
    servicesAvailable: {
      github: boolean;
      twitter: boolean;
      substrate: boolean;
      ipfs: boolean;
    };
  } {
    const status: any = {
      isRunning: this.isRunning,
      lastSyncTimes: Object.fromEntries(this.lastSyncTime),
      servicesAvailable: this.servicesAvailable,
    };

    if (this.cronJob) {
      // Calculate next run time based on cron schedule
      const now = new Date();
      const minutes = now.getMinutes();
      const nextMinutes = Math.ceil(minutes / config.fetchIntervalMinutes) * config.fetchIntervalMinutes;
      const nextRun = new Date(now);
      nextRun.setMinutes(nextMinutes);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      if (nextRun <= now) {
        nextRun.setMinutes(nextRun.getMinutes() + config.fetchIntervalMinutes);
      }
      
      status.nextRunTime = nextRun;
    }

    return status;
  }
}

// Export singleton instance
export const fetcherService = new FetcherService();