/**
 * Shadow Items API Routes
 * Handles shadow item management and retrieval
 */

import { Router, Request, Response } from 'express';
import { substrateService } from '../../services/substrate.service';
import { databaseService } from '../../services/database.service';
import { ipfsService } from '../../services/ipfs.service';
import { cryptoService } from '../../services/crypto.service';
import { apiLogger as logger } from '../../utils/logger';

const router = Router();

/**
 * Get all shadow items for a user (both pending and on-chain)
 */
router.get('/items/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    // Get pending items from database
    const pendingItems = await databaseService.getPendingItems(address);
    
    // Get on-chain items if substrate is connected
    let chainItems: any[] = [];
    if (substrateService.isChainConnected()) {
      const rawItems = await substrateService.getShadowItems(address);
      
      // Parse and format chain items
      chainItems = rawItems.map((item: any) => ({
        id: item.id,
        content: item.content,
        source: item.source,
        timestamp: parseInt(item.timestamp),
        metadata: item.metadata,
        deleted: item.deleted,
        onChain: true
      }));
    }
    
    // Combine and sort by timestamp
    const allItems = [
      ...pendingItems.map((item: any) => ({
        ...item,
        onChain: false
      })),
      ...chainItems
    ].sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({
      success: true,
      items: allItems,
      pending: pendingItems.length,
      onChain: chainItems.length
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get shadow items');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shadow items'
    });
  }
});

/**
 * Get only blockchain items for a user
 */
router.get('/items/:address/blockchain', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { page = 1, perPage = 10 } = req.query;
    
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    
    if (!substrateService.isChainConnected()) {
      return res.json({
        success: true,
        items: [],
        total: 0,
        page: pageNum,
        perPage: perPageNum,
        totalPages: 0
      });
    }
    
    // Get on-chain items
    const rawItems = await substrateService.getShadowItems(address);
    
    // Parse and format chain items
    const chainItems = rawItems.map((item: any) => ({
      id: item.id,
      content: item.content,
      source: item.source,
      timestamp: parseInt(item.timestamp),
      metadata: item.metadata,
      deleted: item.deleted
    }));
    
    // Sort by timestamp (newest first)
    chainItems.sort((a: any, b: any) => b.timestamp - a.timestamp);
    
    // Pagination
    const total = chainItems.length;
    const totalPages = Math.ceil(total / perPageNum);
    const start = (pageNum - 1) * perPageNum;
    const paginatedItems = chainItems.slice(start, start + perPageNum);
    
    res.json({
      success: true,
      items: paginatedItems,
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get blockchain items');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blockchain items',
      items: [],
      total: 0
    });
  }
});

/**
 * Get pending shadow items for a user (not yet on blockchain)
 */
router.get('/pending/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    const pendingItems = await databaseService.getPendingItems(address);
    
    res.json({
      success: true,
      items: pendingItems
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get pending items');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending items'
    });
  }
});

/**
 * Delete a pending shadow item
 */
router.delete('/pending/:address/:itemId', async (req: Request, res: Response) => {
  try {
    const { address, itemId } = req.params;
    
    const deleted = await databaseService.deletePendingItem(address, parseInt(itemId));
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Pending item deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Pending item not found'
      });
    }
  } catch (error) {
    logger.error({ error, params: req.params }, 'Failed to delete pending item');
    res.status(500).json({
      success: false,
      error: 'Failed to delete pending item'
    });
  }
});

/**
 * Get content from IPFS by CID
 * This endpoint retrieves encrypted content from IPFS for client-side decryption
 */
router.get('/ipfs/:cid', async (req: Request, res: Response) => {
  try {
    const { cid } = req.params;
    
    // Validate CID format
    if (!ipfsService.isValidCID(cid)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CID format'
      });
    }
    
    // Check if IPFS is connected
    if (!ipfsService.isConnected()) {
      await ipfsService.connect();
    }
    
    // Retrieve encrypted content from IPFS
    const encryptedData = await ipfsService.retrieveEncrypted(cid);
    
    // Return the encrypted data for client-side decryption
    res.json({
      success: true,
      cid,
      ciphertext: encryptedData.ciphertext.toString('hex'),
      nonce: encryptedData.nonce.toString('hex'),
      metadata: encryptedData.metadata
    });
    
  } catch (error) {
    logger.error({ error, cid: req.params.cid }, 'Failed to retrieve content from IPFS');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve IPFS content'
    });
  }
});

/**
 * Check if user has encryption key registered
 */
router.get('/encryption-status/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    const hasKey = await databaseService.hasUserEncryptionKey(address);
    const userKey = hasKey ? await databaseService.getUserEncryptionKey(address) : null;
    
    res.json({
      success: true,
      hasEncryptionKey: hasKey,
      publicKey: userKey?.publicKey || null,
      keyCreatedAt: userKey?.createdAt || null
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to check encryption status');
    res.status(500).json({
      success: false,
      error: 'Failed to check encryption status'
    });
  }
});

/**
 * Register user's encryption public key
 */
router.post('/register-key', async (req: Request, res: Response) => {
  try {
    const { address, publicKey, signedMessage, deviceId, label } = req.body;
    
    // Validate public key format
    if (!cryptoService.validatePublicKey(publicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid public key format'
      });
    }
    
    // Store the encryption key
    const storedKey = await databaseService.storeUserEncryptionKey(
      address,
      publicKey,
      signedMessage,
      deviceId,
      label
    );
    
    logger.info({ address, deviceId, label }, 'Encryption key registered');
    
    res.json({
      success: true,
      message: 'Encryption key registered successfully',
      keyId: storedKey.id
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Failed to register encryption key');
    res.status(500).json({
      success: false,
      error: 'Failed to register encryption key'
    });
  }
});

/**
 * Get user's active encryption key
 */
router.get('/encryption-key/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    const userKey = await databaseService.getUserEncryptionKey(address);
    
    if (!userKey) {
      return res.status(404).json({
        success: false,
        error: 'No encryption key found for user'
      });
    }
    
    res.json({
      success: true,
      publicKey: userKey.publicKey,
      createdAt: userKey.createdAt,
      deviceId: userKey.deviceId,
      label: userKey.label
    });
  } catch (error) {
    logger.error({ error, address: req.params.address }, 'Failed to get encryption key');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve encryption key'
    });
  }
});

/**
 * Rotate user's encryption key
 */
router.post('/rotate-key', async (req: Request, res: Response) => {
  try {
    const { address, newPublicKey, signedMessage, reason } = req.body;
    
    // Validate new public key format
    if (!cryptoService.validatePublicKey(newPublicKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid public key format'
      });
    }
    
    // Rotate the key
    const newKey = await databaseService.rotateUserEncryptionKey(
      address,
      newPublicKey,
      signedMessage,
      reason
    );
    
    logger.info({ address, reason }, 'Encryption key rotated');
    
    res.json({
      success: true,
      message: 'Encryption key rotated successfully',
      keyId: newKey.id
    });
  } catch (error) {
    logger.error({ error, body: req.body }, 'Failed to rotate encryption key');
    res.status(500).json({
      success: false,
      error: 'Failed to rotate encryption key'
    });
  }
});

/**
 * Test encryption for a user
 */
router.post('/test-encryption', async (req: Request, res: Response) => {
  try {
    const { address, testData } = req.body;
    
    // Get user's encryption key
    const userKey = await databaseService.getUserEncryptionKey(address);
    
    if (!userKey) {
      return res.status(400).json({
        success: false,
        error: 'User has no encryption key registered'
      });
    }
    
    // Encrypt test data
    const encrypted = await cryptoService.encryptForUser(
      testData || 'Test encryption data',
      userKey.publicKey
    );
    
    res.json({
      success: true,
      encrypted: {
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        encryptedKey: encrypted.encryptedKey
      },
      message: 'Encryption test successful. Use your private key to decrypt.'
    });
  } catch (error) {
    logger.error({ error, address: req.body.address }, 'Encryption test failed');
    res.status(500).json({
      success: false,
      error: 'Encryption test failed'
    });
  }
});

export default router;