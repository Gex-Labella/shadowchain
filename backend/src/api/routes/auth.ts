/**
 * Authentication routes for OAuth flows
 *
 */

import { Router, Request, Response, NextFunction } from 'express';
import { oauthService } from '../../services/oauth.service';
import { substrateService } from '../../services/substrate.service';
import { databaseService } from '../../services/database.service';
import { cryptoService } from '../../services/crypto.service';
import { fetcherService } from '../../services/fetcher.service';
import { authLogger as logger } from '../../utils/logger';
import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';

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

    // Trigger immediate sync for this user (don't wait for it to complete)
    logger.info({ userAddress: token.userAddress }, 'Triggering immediate sync after GitHub connection');
    fetcherService.syncUserData(token.userAddress).catch(error => {
      logger.error({ error, userAddress: token.userAddress }, 'Background sync failed after GitHub connection');
    });

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

/**
 * Check user consent status on blockchain
 */
authRouter.get('/consent/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    const hasConsent = await substrateService.hasValidConsent(address);
    const consentRecord = await substrateService.getConsentRecord(address);
    
    res.json({
      address,
      hasValidConsent: hasConsent,
      consentRecord,
      chainConnected: substrateService.isChainConnected()
    });
  } catch (error) {
    logger.error({ error }, 'Failed to check consent status');
    next(error);
  }
});

/**
 * Register user encryption public key
 */
authRouter.post('/register-encryption-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, publicKey, signedMessage, deviceId, label } = req.body;
    
    if (!userAddress || !publicKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate public key format
    if (!cryptoService.validatePublicKey(publicKey)) {
      return res.status(400).json({ error: 'Invalid public key format' });
    }
    
    // Verify the signed message with the user's Polkadot account
    if (signedMessage) {
      try {
        await cryptoWaitReady();
        const message = cryptoService.createKeyOwnershipMessage(userAddress, publicKey);
        const { isValid } = signatureVerify(message, signedMessage, userAddress);
        
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid signature - key ownership verification failed' });
        }
        
        logger.info({
          userAddress,
          publicKey: publicKey.substring(0, 16) + '...',
          signatureValid: true
        }, 'Key ownership verified via signature');
      } catch (sigError) {
        logger.error({ error: sigError, userAddress }, 'Signature verification failed');
        return res.status(401).json({ error: 'Signature verification failed' });
      }
    } else {
      // In development/testing, allow registration without signature
      // In production, this should be enforced
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Signature required for key registration' });
      }
      logger.warn({
        userAddress,
        publicKey: publicKey.substring(0, 16) + '...'
      }, 'Key registered without signature verification (dev mode)');
    }
    
    // Store the encryption key
    const storedKey = await databaseService.storeUserEncryptionKey(
      userAddress,
      publicKey,
      signedMessage,
      deviceId,
      label
    );
    
    logger.info({
      userAddress,
      deviceId,
      label
    }, 'User encryption key registered');
    
    res.json({
      success: true,
      keyId: storedKey.id,
      message: 'Encryption key registered successfully'
    });
  } catch (error) {
    logger.error({ error }, 'Failed to register encryption key');
    next(error);
  }
});

/**
 * Get user encryption key status
 */
authRouter.get('/encryption-key/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    const hasKey = await databaseService.hasUserEncryptionKey(address);
    const key = await databaseService.getUserEncryptionKey(address);
    
    res.json({
      address,
      hasEncryptionKey: hasKey,
      publicKey: key?.publicKey,
      isActive: key?.isActive,
      createdAt: key?.createdAt
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get encryption key status');
    next(error);
  }
});

/**
 * Rotate user encryption key
 */
authRouter.post('/rotate-encryption-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAddress, newPublicKey, signedMessage, reason } = req.body;
    
    if (!userAddress || !newPublicKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate public key format
    if (!cryptoService.validatePublicKey(newPublicKey)) {
      return res.status(400).json({ error: 'Invalid public key format' });
    }
    
    // Rotate the key
    const newKey = await databaseService.rotateUserEncryptionKey(
      userAddress,
      newPublicKey,
      signedMessage,
      reason
    );
    
    logger.info({
      userAddress,
      reason
    }, 'User encryption key rotated');
    
    res.json({
      success: true,
      keyId: newKey.id,
      message: 'Encryption key rotated successfully'
    });
  } catch (error) {
    logger.error({ error }, 'Failed to rotate encryption key');
    next(error);
  }
});

/**
 * Revoke user encryption key
 */
authRouter.delete('/encryption-key/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const { reason } = req.body;
    
    await databaseService.revokeUserEncryptionKey(address, reason);
    
    logger.info({
      userAddress: address,
      reason
    }, 'User encryption key revoked');
    
    res.json({
      success: true,
      message: 'Encryption key revoked successfully'
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke encryption key');
    next(error);
  }
});