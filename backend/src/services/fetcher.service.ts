/**
 * Fetcher Service - Orchestrates data fetching and blockchain storage
 */

import cron from 'node-cron';
import config from '../config';
import { fetcherLogger as logger } from '../utils/logger';
import { githubService, GitHubContent } from './github.service';
import { twitterService, TwitterContent } from './twitter.service';
import { substrateService } from './substrate.service';
import { oauthService } from './oauth.service';
import { databaseService } from './database.service';

type ContentItem = GitHubContent | TwitterContent;

export interface ProcessedItem {
  source: 'github' | 'twitter';
  originalUrl: string;
  content: any; // The raw content to be stored
  timestamp: number;
  txData?: { method: string; args: any[] }; // Unsigned transaction data for user signing
}

export class FetcherService {
  private cronJob?: cron.ScheduledTask;
  private isRunning: boolean = false;
  private lastSyncTime: Map<string, Date> = new Map();
  private servicesAvailable = {
    github: false,
    twitter: false,
    substrate: false
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

      // Initialize database
      try {
        await databaseService.initialize();
        logger.info('Database initialized for fetcher service');
      } catch (error) {
        logger.warn({ error }, 'Database initialization failed - will run without persistence');
      }

      // Run initial sync if all required services are available
      if (this.servicesAvailable.substrate &&
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
    if (!this.servicesAvailable.substrate) {
      logger.warn('Cannot run sync - Substrate not available');
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
        const processed = await this.processContentItem(content, userAddress);
        processedItems.push(processed);
        
        // Store in database for persistence
        try {
          await databaseService.storePendingItem(processed, userAddress);
          logger.debug({
            userAddress,
            source: processed.source
          }, 'Stored pending item in database');
        } catch (dbError) {
          logger.warn({ error: dbError }, 'Failed to store item in database - continuing without persistence');
        }
      } catch (error) {
        logger.error({ error, content }, 'Failed to process content item');
      }
    }

    // Update last sync time
    this.lastSyncTime.set(userAddress, new Date());

    return processedItems;
  }

  /**
   * Process a single content item for blockchain storage
   * No encryption or IPFS - just prepare transaction with raw content
   */
  private async processContentItem(
    content: ContentItem,
    userAddress: string
  ): Promise<ProcessedItem> {
    try {
      // Validate content has required fields
      if (!content.timestamp || !content.url) {
        logger.warn({ content }, 'Skipping content item with missing required fields');
        throw new Error('Missing required fields in content item');
      }

      logger.debug({
        userAddress,
        source: content.source
      }, 'Processing content item for direct blockchain storage');

      // Prepare transaction with raw content for blockchain
      let txData: { method: string; args: any[] } | undefined;
      if (this.servicesAvailable.substrate) {
        const preparedTx = await substrateService.prepareShadowItemTx(
          userAddress,
          JSON.stringify(content), // Store the entire content as JSON
          content.source === 'github' ? 'GitHub' : 'Twitter',
          JSON.stringify({
            timestamp: content.timestamp,
            url: content.url
          })
        );
        txData = preparedTx || undefined;
        
        if (!preparedTx) {
          logger.debug({
            userAddress,
            source: content.source
          }, 'Transaction not prepared - storing in off-chain mode');
        }
      }

      const processed: ProcessedItem = {
        source: content.source,
        originalUrl: content.url,
        content: content,
        timestamp: content.timestamp,
        txData,
      };

      logger.info({
        userAddress,
        source: content.source,
        hasTxData: !!txData
      }, 'Content item processed successfully for direct blockchain storage');

      return processed;
    } catch (error) {
      // Log the actual error details
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        content: {
          source: content.source,
          url: content.url,
          hasTimestamp: !!content.timestamp,
          hasBody: !!content.body
        }
      };
      
      logger.error(errorDetails, 'Failed to process content item - detailed error');
      throw error;
    }
  }

  /**
   * Get users with valid consent
   * In a real implementation, this would query the chain for all users with consent
   * For now, we'll use a simplified approach
   */
  private async getUsersWithConsent(): Promise<string[]> {
    const validUsers: string[] = [];
    
    // First, check for users configured via environment variable
    const configuredUsers = process.env.SHADOW_USERS?.split(',') || [];
    
    // Also get all users who have connected OAuth accounts
    const oauthUsers = await this.getUsersWithOAuthTokens();
    
    // Combine both lists (remove duplicates)
    const allUsers = [...new Set([...configuredUsers, ...oauthUsers])];
    
    // If substrate is available, check for consent
    if (this.servicesAvailable.substrate) {
      for (const user of allUsers) {
        const hasConsent = await substrateService.hasValidConsent(user.trim());
        if (hasConsent) {
          validUsers.push(user.trim());
        }
      }
    } else {
      // If substrate isn't available but we're in development/demo mode,
      // allow OAuth users to sync without blockchain consent
      logger.warn('Substrate not available - allowing OAuth users without blockchain consent for demo');
      return oauthUsers;
    }

    return validUsers;
  }

  /**
   * Get users who have connected OAuth accounts
   */
  private async getUsersWithOAuthTokens(): Promise<string[]> {
    return await oauthService.getAllUsersWithTokens();
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