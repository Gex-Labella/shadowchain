/**
 * Authentication routes for OAuth flows
 */

import { Router, Request, Response, NextFunction } from 'express';
import { oauthService } from '../../services/oauth.service';
import { substrateService } from '../../services/substrate.service';
import { authLogger as logger } from '../../utils/logger';

export const authRouter = Router();

/**
 * Initialize GitHub OAuth flow
 */
authRouter.post('/github/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.body;

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' });
    }

    // Check if user has consent on-chain
    const hasConsent = await substrateService.hasValidConsent(userAddress);
    if (!hasConsent) {
      return res.status(403).json({ 
        error: 'Please grant consent on-chain before connecting GitHub' 
      });
    }

    // Generate OAuth URL
    const authUrl = oauthService.getGitHubAuthUrl(userAddress);

    res.json({
      authUrl,
      message: 'Redirect user to this URL to connect GitHub',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to initialize GitHub OAuth');
    next(error);
  }
});

/**
 * GitHub OAuth callback
 */
authRouter.get('/github/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Exchange code for token
    const token = await oauthService.exchangeGitHubCode(
      code as string,
      state as string
    );

    if (!token) {
      return res.status(401).json({ error: 'Failed to authenticate with GitHub' });
    }

    // In production, redirect to frontend with success message
    // For now, return JSON response
    res.json({
      success: true,
      userAddress: token.userAddress,
      username: token.accountUsername,
      message: 'GitHub account connected successfully',
    });
  } catch (error) {
    logger.error({ error }, 'GitHub OAuth callback failed');
    next(error);
  }
});

/**
 * Get user's connected accounts
 */
authRouter.get('/connections/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    const connections = await oauthService.getConnectedAccounts(userAddress);

    res.json({
      userAddress,
      connections,
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to get connections');
    next(error);
  }
});

/**
 * Revoke OAuth connection
 */
authRouter.delete('/connections/:userAddress/:service', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, service } = req.params;

    if (service !== 'github' && service !== 'twitter') {
      return res.status(400).json({ error: 'Invalid service' });
    }

    const success = await oauthService.revokeToken(userAddress, service);

    if (!success) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({
      success: true,
      message: `${service} connection revoked`,
    });
  } catch (error) {
    logger.error({ 
      error, 
      userAddress: req.params.userAddress,
      service: req.params.service 
    }, 'Failed to revoke connection');
    next(error);
  }
});

/**
 * Check if user has valid GitHub token
 */
authRouter.get('/github/status/:userAddress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.params;

    const hasValidToken = await oauthService.hasValidGitHubToken(userAddress);

    res.json({
      userAddress,
      hasValidToken,
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to check GitHub status');
    next(error);
  }
});