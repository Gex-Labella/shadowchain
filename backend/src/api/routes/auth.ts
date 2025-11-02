/**
 * Authentication routes for OAuth flows
 * 
 */

import { Router, Request, Response, NextFunction } from 'express';
import { oauthService } from '../../services/oauth.service';
import { substrateService } from '../../services/substrate.service';
import { authLogger as logger } from '../../utils/logger';

export const authRouter = Router();

/**
 * Initialize GitHub OAuth flow
 * 
 */
authRouter.post('/github/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress } = req.body;

    if (!userAddress) {
      return res.status(400).json({ error: 'User address is required' });
    }

    // Check consent only if parachain is connected
    // If not connected, allow OAuth to proceed (off-chain only mode)
    if (substrateService.isChainConnected()) {
      const hasConsent = await substrateService.hasValidConsent(userAddress);
      if (!hasConsent) {
        logger.info({ userAddress }, 'No on-chain consent found, but allowing OAuth (chain optional)');
        // Don't block OAuth if chain check fails - just log it
      }
    } else {
      logger.info({ userAddress }, 'Parachain not connected - proceeding with OAuth in off-chain mode');
    }

    // Generate OAuth URL
    const authUrl = oauthService.getGitHubAuthUrl(userAddress);

    res.json({
      authUrl,
      message: 'Redirect user to this URL to connect GitHub',
      chainConnected: substrateService.isChainConnected(),
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
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/oauth/callback?error=missing_params`);
    }

    // Exchange code for token
    const token = await oauthService.exchangeGitHubCode(
      code as string,
      state as string
    );

    if (!token) {
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/oauth/callback?error=auth_failed`);
    }

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/oauth/callback?success=true&service=github&username=${token.accountUsername}`);
  } catch (error) {
    logger.error({ error }, 'GitHub OAuth callback failed');
    
    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/oauth/callback?error=callback_error`);
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
      chainConnected: substrateService.isChainConnected(),
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
      chainConnected: substrateService.isChainConnected(),
    });
  } catch (error) {
    logger.error({ error, userAddress: req.params.userAddress }, 'Failed to check GitHub status');
    next(error);
  }
});

/**
 * Get chain connection status
 */
authRouter.get('/chain/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chainInfo = await substrateService.getChainInfo();
    
    res.json({
      ...chainInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get chain status');
    res.json({
      connected: false,
      message: 'Parachain not available',
      timestamp: new Date().toISOString(),
    });
  }
});