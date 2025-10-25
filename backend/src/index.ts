/**
 * Shadow Chain Backend Service Entry Point
 */

import 'dotenv/config';
import { validateConfig } from './config';
import logger from './utils/logger';
import { startApiServer } from './api';
import { fetcherService } from './services/fetcher.service';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Shadow Chain Backend Service');

    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Start API server
    await startApiServer();

    // Start fetcher service
    await fetcherService.start();

    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    logger.info('Shadow Chain Backend Service started successfully');
  } catch (error) {
    logger.fatal({ error }, 'Failed to start backend service');
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
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error in main');
  process.exit(1);
});