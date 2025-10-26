/**
 * Shadow Chain API routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { substrateService } from '../../services/substrate.service';
import { fetcherService } from '../../services/fetcher.service';
import { ipfsService } from '../../services/ipfs.service';
import { apiLogger as logger } from '../../utils/logger';

export const shadowRouter = Router();

/**
 * Get shadow items for an address
 */
shadowRouter.get('/items/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const includeDeleted = req.query.includeDeleted === 'true';

    const items = includeDeleted 
      ? await substrateService.getShadowItems(address)
      : await substrateService.getActiveShadowItems(address);

    // Don't include encrypted keys in response for security
    const sanitizedItems = items.map(item => ({
      id: item.id,
      cid: item.cid,
      timestamp: item.timestamp,
      source: item.source,
      metadata: item.metadata,
      deleted: item.deleted,
    }));

    res.json({
      address,
      count: sanitizedItems.length,
      items: sanitizedItems,
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get shadow items');
    next(error);
  }
});

/**
 * Get consent status for an address
 */
shadowRouter.get('/consent/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    const [hasConsent, consentRecord] = await Promise.all([
      substrateService.hasValidConsent(address),
      substrateService.getConsentRecord(address),
    ]);

    res.json({
      address,
      hasValidConsent: hasConsent,
      consent: consentRecord,
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get consent status');
    next(error);
  }
});

/**
 * Trigger manual sync for an address
 */
shadowRouter.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Check if user has consent
    const hasConsent = await substrateService.hasValidConsent(address);
    if (!hasConsent) {
      return res.status(403).json({ error: 'User does not have valid consent' });
    }

    // Trigger sync
    const processedItems = await fetcherService.syncUser(address);

    return res.json({
      address,
      synced: processedItems.length,
      items: processedItems,
    });
  } catch (error) {
    logger.error({ error, address: req.body.address }, 'Failed to sync user');
    next(error);
  }
});

/**
 * Get sync status
 */
shadowRouter.get('/sync/status', (req: Request, res: Response) => {
  const status = fetcherService.getSyncStatus();
  res.json(status);
});

/**
 * Get decrypted content (requires encrypted key from client)
 */
shadowRouter.post('/decrypt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cid, encryptedContent } = req.body;

    if (!cid || !encryptedContent) {
      return res.status(400).json({ error: 'CID and encrypted content are required' });
    }

    // Note: In production, you might want additional authorization here
    // to ensure the user has permission to access this content

    // Retrieve content from IPFS
    const ipfsContent = await ipfsService.retrieve(cid);
    
    return res.json({
      cid,
      content: ipfsContent.toString('base64'),
      size: ipfsContent.length,
    });
  } catch (error) {
    logger.error({ error, cid: req.body.cid }, 'Failed to retrieve content');
    next(error);
  }
});

/**
 * Debug endpoint to get GitHub rate limit (dev only)
 */
if (process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
  shadowRouter.get('/debug/github-rate-limit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { githubService } = await import('../../services/github.service');
      const rateLimit = await githubService.getRateLimitStatus();
      res.json(rateLimit);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Debug endpoint to get Twitter rate limit (dev only)
   */
  shadowRouter.get('/debug/twitter-rate-limit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { twitterService } = await import('../../services/twitter.service');
      const rateLimit = await twitterService.getRateLimitStatus();
      res.json(rateLimit);
    } catch (error) {
      next(error);
    }
  });
}