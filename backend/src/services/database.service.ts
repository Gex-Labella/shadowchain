/**
 * Database Service for PostgreSQL operations
 * Handles persistence of pending shadow items
 */

import { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import { dbLogger as logger } from '../utils/logger';
import { ProcessedItem } from './fetcher.service';
import { UserEncryptionKey } from './crypto.service';

export interface PendingShadowItem {
  id?: number;
  userAddress: string;
  source: 'github' | 'twitter';
  originalUrl: string;
  content: any; // Raw content to be stored on blockchain
  timestamp: number;
  txData?: any;
  metadata?: any;
  createdAt?: Date;
}

export interface StoredEncryptionKey extends UserEncryptionKey {
  id: number;
  deviceId?: string;
  label?: string;
  isActive: boolean;
  metadata?: any;
  updatedAt: Date;
}

export class DatabaseService {
  private pool: Pool;
  private isInitialized: boolean = false;

  constructor() {
    // Parse the database URL from docker-compose
    const dbUrl = process.env.DATABASE_URL || 'postgresql://shadowchain:shadowpass@postgres:5432/shadowchain';
    
    this.pool = new Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error({ error: err }, 'Unexpected error on idle database client');
    });
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database connection established');

      // Run migrations
      await this.runMigrations();
      
      this.isInitialized = true;
      logger.info('Database service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Create migrations table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of migration files
      const migrationsDir = path.join(__dirname, '../db/migrations');
      let migrationFiles: string[] = [];
      
      try {
        migrationFiles = await fs.readdir(migrationsDir);
        migrationFiles = migrationFiles.filter(f => f.endsWith('.sql')).sort();
      } catch (error) {
        logger.info('No migrations directory found, skipping migrations');
        return;
      }

      // Check which migrations have been run
      const result = await client.query('SELECT filename FROM migrations');
      const executedMigrations = new Set(result.rows.map((r: any) => r.filename));

      // Run pending migrations
      for (const file of migrationFiles) {
        if (!executedMigrations.has(file)) {
          logger.info({ migration: file }, 'Running migration');
          
          const migrationPath = path.join(migrationsDir, file);
          const migrationSql = await fs.readFile(migrationPath, 'utf-8');
          
          // Execute migration in a transaction
          await client.query('BEGIN');
          try {
            // Execute the entire migration as a single statement
            // This preserves function definitions and other complex SQL
            await client.query(migrationSql);
            
            // Record migration as executed
            await client.query(
              'INSERT INTO migrations (filename) VALUES ($1)',
              [file]
            );
            
            await client.query('COMMIT');
            logger.info({ migration: file }, 'Migration completed');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }
      }
      
      logger.info('All migrations completed');
    } finally {
      client.release();
    }
  }

  /**
   * Store a pending shadow item
   */
  async storePendingItem(item: ProcessedItem, userAddress: string): Promise<PendingShadowItem> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO pending_shadow_items
        (user_address, source, original_url, content, timestamp, tx_data, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_address, original_url, timestamp) DO UPDATE
        SET
          content = EXCLUDED.content,
          tx_data = EXCLUDED.tx_data,
          metadata = EXCLUDED.metadata,
          created_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [
        userAddress,
        item.source,
        item.originalUrl,
        JSON.stringify(item.content), // Store content as JSON
        item.timestamp,
        item.txData ? JSON.stringify(item.txData) : null,
        null // metadata will be added later if needed
      ];
      
      const result = await client.query(query, values);
      
      logger.debug({
        userAddress,
        source: item.source,
        url: item.originalUrl
      }, 'Stored pending shadow item');
      
      return this.mapRowToItem(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get pending items for a user
   */
  async getPendingItems(userAddress: string): Promise<PendingShadowItem[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM pending_shadow_items 
        WHERE user_address = $1 
        ORDER BY timestamp DESC
      `;
      
      const result = await client.query(query, [userAddress]);
      
      return result.rows.map((row: any) => this.mapRowToItem(row));
    } finally {
      client.release();
    }
  }

  /**
   * Get pending items with transaction data ready for signing
   */
  async getPendingTransactions(userAddress: string): Promise<PendingShadowItem[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM pending_shadow_items 
        WHERE user_address = $1 AND tx_data IS NOT NULL
        ORDER BY timestamp DESC
      `;
      
      const result = await client.query(query, [userAddress]);
      
      return result.rows.map((row: any) => this.mapRowToItem(row));
    } finally {
      client.release();
    }
  }

  /**
   * Delete a pending item (after blockchain submission)
   */
  async deletePendingItem(userAddress: string, itemId: number): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        DELETE FROM pending_shadow_items
        WHERE user_address = $1 AND id = $2
      `;
      
      const result = await client.query(query, [userAddress, itemId]);
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info({
          userAddress,
          itemId
        }, 'Deleted pending item after blockchain submission');
        return true;
      }
      
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Delete all pending items for a user
   */
  async deleteAllPendingItems(userAddress: string): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        DELETE FROM pending_shadow_items 
        WHERE user_address = $1
      `;
      
      const result = await client.query(query, [userAddress]);
      
      logger.info({ 
        userAddress, 
        count: result.rowCount 
      }, 'Deleted all pending items for user');
      
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up old pending items (older than 7 days)
   */
  async cleanupOldPendingItems(): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        DELETE FROM pending_shadow_items 
        WHERE created_at < NOW() - INTERVAL '7 days'
      `;
      
      const result = await client.query(query);
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info({ 
          count: result.rowCount 
        }, 'Cleaned up old pending items');
      }
      
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to PendingShadowItem
   */
  private mapRowToItem(row: any): PendingShadowItem {
    return {
      id: row.id,
      userAddress: row.user_address,
      source: row.source,
      originalUrl: row.original_url,
      content: row.content, // Already parsed as JSON by PostgreSQL
      timestamp: parseInt(row.timestamp),
      txData: row.tx_data,
      metadata: row.metadata,
      createdAt: row.created_at
    };
  }

  /**
   * Store user encryption public key
   */
  async storeUserEncryptionKey(
    userAddress: string,
    publicKey: string,
    signedMessage?: string,
    deviceId?: string,
    label?: string
  ): Promise<StoredEncryptionKey> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deactivate previous keys for this user (if any)
      await client.query(
        'UPDATE user_encryption_keys SET is_active = false WHERE user_address = $1',
        [userAddress]
      );
      
      // Insert new key
      const insertQuery = `
        INSERT INTO user_encryption_keys
        (user_address, public_key, signed_message, device_id, label, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `;
      
      const insertValues = [
        userAddress,
        publicKey,
        signedMessage,
        deviceId,
        label
      ];
      
      const result = await client.query(insertQuery, insertValues);
      
      // Record in history
      await client.query(
        `INSERT INTO user_encryption_key_history
         (user_address, public_key, action, device_id)
         VALUES ($1, $2, 'created', $3)`,
        [userAddress, publicKey, deviceId]
      );
      
      await client.query('COMMIT');
      
      logger.info({
        userAddress,
        deviceId,
        label
      }, 'Stored new user encryption key');
      
      return this.mapRowToEncryptionKey(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active encryption key for a user
   */
  async getUserEncryptionKey(userAddress: string): Promise<StoredEncryptionKey | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM user_encryption_keys
        WHERE user_address = $1 AND is_active = true
        LIMIT 1
      `;
      
      const result = await client.query(query, [userAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEncryptionKey(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get all encryption keys for a user (including inactive)
   */
  async getAllUserEncryptionKeys(userAddress: string): Promise<StoredEncryptionKey[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM user_encryption_keys
        WHERE user_address = $1
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [userAddress]);
      
      return result.rows.map(row => this.mapRowToEncryptionKey(row));
    } finally {
      client.release();
    }
  }

  /**
   * Check if user has an encryption key
   */
  async hasUserEncryptionKey(userAddress: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM user_encryption_keys
          WHERE user_address = $1 AND is_active = true
        )
      `;
      
      const result = await client.query(query, [userAddress]);
      
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  /**
   * Rotate user encryption key
   */
  async rotateUserEncryptionKey(
    userAddress: string,
    newPublicKey: string,
    signedMessage?: string,
    reason?: string
  ): Promise<StoredEncryptionKey> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current active key
      const currentKeyResult = await client.query(
        'SELECT public_key FROM user_encryption_keys WHERE user_address = $1 AND is_active = true',
        [userAddress]
      );
      
      const previousPublicKey = currentKeyResult.rows[0]?.public_key;
      
      // Deactivate current key
      await client.query(
        'UPDATE user_encryption_keys SET is_active = false WHERE user_address = $1',
        [userAddress]
      );
      
      // Insert new key
      const insertQuery = `
        INSERT INTO user_encryption_keys
        (user_address, public_key, signed_message, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING *
      `;
      
      const result = await client.query(insertQuery, [
        userAddress,
        newPublicKey,
        signedMessage
      ]);
      
      // Record rotation in history
      await client.query(
        `INSERT INTO user_encryption_key_history
         (user_address, public_key, action, reason, previous_public_key)
         VALUES ($1, $2, 'rotated', $3, $4)`,
        [userAddress, newPublicKey, reason, previousPublicKey]
      );
      
      await client.query('COMMIT');
      
      logger.info({
        userAddress,
        reason
      }, 'Rotated user encryption key');
      
      return this.mapRowToEncryptionKey(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke user encryption key
   */
  async revokeUserEncryptionKey(userAddress: string, reason?: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current active key
      const currentKeyResult = await client.query(
        'SELECT public_key FROM user_encryption_keys WHERE user_address = $1 AND is_active = true',
        [userAddress]
      );
      
      if (currentKeyResult.rows.length > 0) {
        const publicKey = currentKeyResult.rows[0].public_key;
        
        // Deactivate key
        await client.query(
          'UPDATE user_encryption_keys SET is_active = false WHERE user_address = $1',
          [userAddress]
        );
        
        // Record revocation in history
        await client.query(
          `INSERT INTO user_encryption_key_history
           (user_address, public_key, action, reason)
           VALUES ($1, $2, 'revoked', $3)`,
          [userAddress, publicKey, reason]
        );
      }
      
      await client.query('COMMIT');
      
      logger.info({
        userAddress,
        reason
      }, 'Revoked user encryption key');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get encryption key history for a user
   */
  async getUserEncryptionKeyHistory(userAddress: string): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM user_encryption_key_history
        WHERE user_address = $1
        ORDER BY timestamp DESC
      `;
      
      const result = await client.query(query, [userAddress]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to StoredEncryptionKey
   */
  private mapRowToEncryptionKey(row: any): StoredEncryptionKey {
    return {
      id: row.id,
      address: row.user_address,
      publicKey: row.public_key,
      signedMessage: row.signed_message,
      createdAt: row.created_at,
      deviceId: row.device_id,
      label: row.label,
      isActive: row.is_active,
      metadata: row.metadata,
      updatedAt: row.updated_at
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection closed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();