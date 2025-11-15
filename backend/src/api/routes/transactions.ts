/**
 * Transaction preparation routes for user signing
 * This allows users to sign their own transactions (proper Web3 way)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { apiLogger as logger } from '../../utils/logger';
import { fetcherService } from '../../services/fetcher.service';
import { substrateService } from '../../services/substrate.service';
import { oauthService } from '../../services/oauth.service';
import { databaseService } from '../../services/database.service';

export const transactionRouter = Router();

/**
 * Get pending transactions for user to sign
 * This returns content that's ready to be submitted to the chain
 */
transactionRouter.get('/pending/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    // Check if user has OAuth tokens
    const hasGitHubToken = await oauthService.hasValidGitHubToken(userAddress);
    if (!hasGitHubToken) {
      return res.json({
        userAddress,
        pendingTransactions: [],
        message: 'No OAuth connections found'
      });
    }

    // Get pending transactions from database
    const pendingItems = await databaseService.getPendingTransactions(userAddress);

    // Map database items to transaction format
    const pendingTransactions = pendingItems.map(item => ({
      id: item.id,
      source: item.source === 'github' ? 'GitHub' : 'Twitter',
      content: item.content,
      timestamp: item.timestamp,
      originalUrl: item.originalUrl,
      txData: item.txData
    }));

    res.json({
      userAddress,
      pendingTransactions,
      total: pendingTransactions.length,
      chainConnected: substrateService.isChainConnected(),
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to get pending transactions');
    next(error);
  }
});

/**
 * Prepare a single shadow item transaction
 * Used when user wants to manually submit a specific item
 */
transactionRouter.post('/prepare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, content, source, metadata } = req.body;

    if (!userAddress || !content || !source) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['userAddress', 'content', 'source']
      });
    }

    // Validate source
    if (source !== 'GitHub' && source !== 'Twitter') {
      return res.status(400).json({
        error: 'Invalid source. Must be "GitHub" or "Twitter"'
      });
    }

    // Prepare the transaction
    const txData = await substrateService.prepareShadowItemTx(
      userAddress,
      JSON.stringify(content),
      source,
      metadata || ''
    );

    if (!txData) {
      return res.status(503).json({
        error: 'Blockchain not available',
        message: 'Cannot prepare transaction while parachain is offline'
      });
    }

    res.json({
      success: true,
      txData,
      message: 'Transaction prepared successfully. Sign and submit with your wallet.'
    });
  } catch (error) {
    logger.error({ error }, 'Failed to prepare transaction');
    next(error);
  }
});

/**
 * Sync and get transactions in one call
 * This is a convenience endpoint for the frontend
 */
transactionRouter.post('/sync-and-prepare/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    // Check if user has OAuth token
    const hasGitHubToken = await oauthService.hasValidGitHubToken(userAddress);
    if (!hasGitHubToken) {
      return res.status(400).json({
        error: 'User must connect GitHub account first'
      });
    }

    // Sync user data to get fresh items
    const newItems = await fetcherService.syncUserData(userAddress);
    
    // Get all pending transactions from database (including newly synced)
    const pendingItems = await databaseService.getPendingTransactions(userAddress);

    // Map to transaction format
    const transactions = pendingItems.map(item => ({
      id: item.id,
      source: item.source === 'github' ? 'GitHub' : 'Twitter',
      content: item.content,
      timestamp: item.timestamp,
      originalUrl: item.originalUrl,
      txData: item.txData
    }));

    res.json({
      userAddress,
      itemsSynced: newItems.length,
      transactionsReady: transactions.length,
      transactions,
      chainConnected: substrateService.isChainConnected(),
      message: `Synced ${newItems.length} items, ${transactions.length} ready for signing`
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to sync and prepare transactions');
    next(error);
  }
});

/**
 * Mark a transaction as submitted (delete from pending)
 * Called after user successfully submits to blockchain
 */
transactionRouter.delete('/pending/:userAddress/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, itemId } = req.params;

    const deleted = await databaseService.deletePendingItem(userAddress, parseInt(itemId));

    if (deleted) {
      logger.info({
        userAddress,
        itemId
      }, 'Pending item removed after blockchain submission');
      
      res.json({
        success: true,
        message: 'Pending item removed successfully'
      });
    } else {
      res.status(404).json({
        error: 'Pending item not found'
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete pending item');
    next(error);
  }
});