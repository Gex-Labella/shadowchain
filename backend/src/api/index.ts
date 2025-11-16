/**
 * REST API for Shadow Chain Backend
 */

import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config';
import { apiLogger as logger } from '../utils/logger';
import { healthRouter } from './routes/health';
import shadowRouter from './routes/shadow';
import { authRouter } from './routes/auth';
import { transactionRouter } from './routes/transactions';
import { errorHandler } from './middleware/error-handler';

export function createApi(): express.Application {
  const app = express();

  // Trust proxy when running behind reverse proxies (Docker, nginx, etc)
  // Set to 1 for single proxy to avoid rate limiting bypass vulnerability
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(cors(config.cors));
  
  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }, 'Request completed');
    });

    next();
  });

  // API routes
  const apiRouter = Router();
  
  // Mount routes
  apiRouter.use('/health', healthRouter);
  apiRouter.use('/shadow', shadowRouter);
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/transactions', transactionRouter);

  // Mount API router
  app.use('/api', apiRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start the API server
 */
export async function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const app = createApi();
      
      const server = app.listen(config.port, () => {
        logger.info({ port: config.port }, 'API server started');
        resolve();
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.error({ port: config.port }, 'Port is already in use');
          reject(new Error(`Port ${config.port} is already in use`));
        } else {
          logger.error({ error }, 'Failed to start API server');
          reject(error);
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create API server');
      reject(error);
    }
  });
}