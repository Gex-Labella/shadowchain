/**
 * Shadow Chain API routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { apiLogger as logger } from '../../utils/logger';
import { fetcherService } from '../../services/fetcher.service';
import { substrateService, ShadowItem } from '../../services/substrate.service';
import { oauthService } from '../../services/oauth.service';
import { databaseService } from '../../services/database.service';
import { githubService } from '../../services/github.service';

export const shadowRouter = Router();

/**
 * Get shadow items for a user
 */
shadowRouter.get('/items/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    // Get items from blockchain (if available)
    let chainItems: ShadowItem[] = [];
    try {
      chainItems = await substrateService.getActiveShadowItems(userAddress);
    } catch (err) {
      logger.debug({ error: err }, 'Could not get items from blockchain');
    }

    // If no items on chain, get pending items from database
    if (chainItems.length === 0) {
      try {
        const pendingItems = await databaseService.getPendingItems(userAddress);
        
        if (pendingItems.length > 0) {
          // Convert database items to shadow item format for display
          const formattedItems = pendingItems.map((item) => ({
            id: `pending-${item.id}`,
            content: JSON.stringify(item.content),
            timestamp: item.timestamp,
            source: item.source === 'github' ? 'GitHub' : 'Twitter',
            metadata: JSON.stringify({ url: item.originalUrl }),
            deleted: false,
            pending: true // Mark as pending
          }));
          
          logger.info({
            userAddress,
            pendingCount: formattedItems.length
          }, 'Returning pending items from database');
          
          return res.json({
            userAddress,
            items: formattedItems,
            total: formattedItems.length,
            chainConnected: substrateService.isChainConnected(),
            pending: true, // Indicate these are pending items
          });
        }
      } catch (dbError) {
        logger.error({ error: dbError }, 'Failed to get pending items from database');
      }
    }

    res.json({
      userAddress,
      items: chainItems,
      total: chainItems.length,
      chainConnected: substrateService.isChainConnected(),
      pending: false,
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to get shadow items');
    next(error);
  }
});

/**
 * Get sync status
 */
shadowRouter.get('/sync/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = fetcherService.getSyncStatus();
    res.json(status);
  } catch (error) {
    logger.error({ error }, 'Failed to get sync status');
    next(error);
  }
});

/**
 * Manually trigger sync for a user
 */
shadowRouter.post('/sync/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    // Check if user has OAuth token
    const hasGitHubToken = await oauthService.hasValidGitHubToken(userAddress);
    if (!hasGitHubToken) {
      return res.status(400).json({
        error: 'User must connect GitHub account first'
      });
    }

    // Trigger sync
    const items = await fetcherService.syncUser(userAddress);

    // Also get the current shadow items from blockchain/storage
    const shadowItems = await substrateService.getActiveShadowItems(userAddress);

    res.json({
      userAddress,
      itemsSynced: items.length,
      processedItems: items,
      totalItems: shadowItems.length,
      shadowItems: shadowItems,
      message: `Successfully synced ${items.length} items`,
    });
  } catch (error: any) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to sync user');
    if (error.message?.includes('consent')) {
      res.status(403).json({ error: 'User does not have valid blockchain consent' });
    } else {
      next(error);
    }
  }
});

/**
 * Manually trigger sync for all users (admin endpoint)
 */
shadowRouter.post('/sync/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In production, this should be protected by admin authentication
    const items = await fetcherService.runSync();

    res.json({
      itemsSynced: items.length,
      items,
      message: `Successfully synced ${items.length} items across all users`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to run sync');
    next(error);
  }
});

// Note: IPFS endpoints have been removed since content is stored directly on blockchain

/**
 * Grant consent on blockchain
 */
shadowRouter.post('/consent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, messageHash, duration } = req.body;

    if (!userAddress || !messageHash) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const txHash = await substrateService.grantConsent(
      userAddress,
      messageHash,
      duration
    );

    if (!txHash) {
      return res.status(503).json({ 
        error: 'Blockchain not available',
        message: 'Cannot grant consent while parachain is offline' 
      });
    }

    res.json({
      success: true,
      txHash,
      message: 'Consent granted successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to grant consent');
    next(error);
  }
});

/**
 * Revoke consent on blockchain
 */
shadowRouter.delete('/consent/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    const txHash = await substrateService.revokeConsent(userAddress);

    if (!txHash) {
      return res.status(503).json({ 
        error: 'Blockchain not available',
        message: 'Cannot revoke consent while parachain is offline' 
      });
    }

    res.json({
      success: true,
      txHash,
      message: 'Consent revoked successfully',
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to revoke consent');
    next(error);
  }
});

/**
 * Get consent status
 */
shadowRouter.get('/consent/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    const hasConsent = await substrateService.hasValidConsent(userAddress);
    const consentRecord = await substrateService.getConsentRecord(userAddress);

    res.json({
      userAddress,
      hasValidConsent: hasConsent,
      consentRecord,
      chainConnected: substrateService.isChainConnected(),
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to check consent');
    next(error);
  }
});

/**
 * Get user's GitHub repositories
 */
shadowRouter.get('/github/repositories/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;
    const { page = '1', perPage = '20' } = req.query;

    // Get user's GitHub token
    const githubToken = await oauthService.getGitHubToken(userAddress);
    if (!githubToken) {
      return res.status(401).json({
        error: 'GitHub account not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    // Fetch repositories
    const repositories = await githubService.getUserRepositories(
      githubToken,
      parseInt(page as string),
      parseInt(perPage as string)
    );

    res.json({
      repositories,
      page: parseInt(page as string),
      perPage: parseInt(perPage as string),
      total: repositories.length
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to fetch repositories');
    next(error);
  }
});

/**
 * Get commits for a specific repository
 */
shadowRouter.get('/github/repositories/:repoFullName/commits', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoFullName } = req.params;
    const { userAddress, page = '1', perPage = '10' } = req.query;

    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress query parameter is required' });
    }

    // Get user's GitHub token
    const githubToken = await oauthService.getGitHubToken(userAddress as string);
    if (!githubToken) {
      return res.status(401).json({
        error: 'GitHub account not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    // Fetch commits
    const commits = await githubService.getRepositoryCommits(
      githubToken,
      repoFullName,
      parseInt(page as string),
      parseInt(perPage as string)
    );

    // Format commits for preview
    const formattedCommits = await Promise.all(
      commits.map(async (commit: any) => {
        const content = await githubService.getFormattedCommit(
          githubToken,
          repoFullName,
          commit.sha
        );
        return {
          sha: commit.sha,
          message: commit.commit?.message || commit.message || 'No message',
          author: {
            name: commit.commit?.author?.name || commit.author?.name || 'Unknown',
            email: commit.commit?.author?.email || commit.author?.email || 'unknown@example.com',
            date: commit.commit?.author?.date || commit.author?.date || new Date().toISOString()
          },
          content: content,
          contentSize: JSON.stringify(content).length
        };
      })
    );

    res.json({
      repository: repoFullName,
      commits: formattedCommits,
      page: parseInt(page as string),
      perPage: parseInt(perPage as string),
      total: formattedCommits.length
    });
  } catch (error) {
    logger.error({ error, repoFullName: req.params.repoFullName }, 'Failed to fetch commits');
    next(error);
  }
});

/**
 * Submit a single commit as a shadow item
 */
shadowRouter.post('/github/submit-commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, repoFullName, commitSha } = req.body;

    if (!userAddress || !repoFullName || !commitSha) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check consent
    const hasConsent = await substrateService.hasValidConsent(userAddress);
    if (!hasConsent) {
      return res.status(403).json({
        error: 'No valid blockchain consent',
        message: 'Please grant consent before submitting shadow items'
      });
    }

    // Get user's GitHub token
    const githubToken = await oauthService.getGitHubToken(userAddress);
    if (!githubToken) {
      return res.status(401).json({
        error: 'GitHub account not connected',
        message: 'Please connect your GitHub account first'
      });
    }

    // Get formatted commit content
    const content = await githubService.getFormattedCommit(
      githubToken,
      repoFullName,
      commitSha
    );

    // Prepare transaction for user to sign
    const preparedTx = await substrateService.prepareShadowItemTx(
      userAddress,
      JSON.stringify(content),
      'GitHub',
      JSON.stringify({ repo: repoFullName, sha: commitSha })
    );

    if (!preparedTx) {
      return res.status(503).json({
        error: 'Blockchain not available',
        message: 'Cannot submit shadow item while parachain is offline'
      });
    }

    res.json({
      success: true,
      transaction: preparedTx,
      content: content,
      message: 'Transaction prepared for signing'
    });
  } catch (error) {
    logger.error({ error, commitSha: req.body.commitSha }, 'Failed to submit commit');
    next(error);
  }
});

/**
 * Get only blockchain-submitted shadow items (not pending)
 */
shadowRouter.get('/items/:userAddress/blockchain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;
    const { page = '1', perPage = '20' } = req.query;

    // Get items from blockchain only
    let chainItems: ShadowItem[] = [];
    try {
      chainItems = await substrateService.getActiveShadowItems(userAddress);
    } catch (err) {
      logger.debug({ error: err }, 'Could not get items from blockchain');
    }

    // Implement pagination
    const startIndex = (parseInt(page as string) - 1) * parseInt(perPage as string);
    const endIndex = startIndex + parseInt(perPage as string);
    const paginatedItems = chainItems.slice(startIndex, endIndex);

    res.json({
      userAddress,
      items: paginatedItems,
      page: parseInt(page as string),
      perPage: parseInt(perPage as string),
      total: chainItems.length,
      totalPages: Math.ceil(chainItems.length / parseInt(perPage as string)),
      chainConnected: substrateService.isChainConnected()
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to get blockchain shadow items');
    next(error);
  }
});

// Note: Decrypt endpoint has been removed since encryption is no longer used