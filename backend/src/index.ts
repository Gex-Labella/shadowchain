/**
 * Shadow Chain Backend Service Entry Point
 */

import 'dotenv/config';
import { validateConfig } from './config';
import logger from './utils/logger';
import { startApiServer } from './api';
import { fetcherService } from './services/fetcher.service';
import { databaseService } from './services/database.service';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Shadow Chain Backend Service');

    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Initialize database service (runs migrations)
    await databaseService.initialize();
    logger.info('Database initialized');

    // Start API server
    await startApiServer();

    // Start fetcher service
    await fetcherService.start();

    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    logger.info('Shadow Chain Backend Service started successfully');
  } catch (error) {
    // Better error logging
    if (error instanceof Error) {
      logger.fatal({ 
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }, 'Failed to start backend service');
    } else {
      logger.fatal({ error: String(error) }, 'Failed to start backend service');
    }
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  
  try {
    // Stop fetcher service
    await fetcherService.stop();
    
    // Close database connections
    await databaseService.close();
    
    // Give ongoing requests time to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ 
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ 
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      name: reason.name
    } : String(reason),
    promise 
  }, 'Unhandled promise rejection');
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.fatal({ 
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : String(error)
  }, 'Fatal error in main');
  process.exit(1);
});