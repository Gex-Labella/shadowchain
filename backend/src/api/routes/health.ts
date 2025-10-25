/**
 * Health check routes
 */

import { Router } from 'express';
import { ipfsService } from '../../services/ipfs.service';
import { substrateService } from '../../services/substrate.service';

export const healthRouter = Router();

/**
 * Basic health check
 */
healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check
 */
healthRouter.get('/detailed', async (req, res) => {
  try {
    const [ipfsHealth, substrateHealth] = await Promise.all([
      ipfsService.healthCheck(),
      substrateService.healthCheck(),
    ]);

    const health = {
      status: ipfsHealth && substrateHealth ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        ipfs: {
          connected: ipfsHealth,
          info: ipfsHealth ? await ipfsService.getNodeInfo() : null,
        },
        substrate: {
          connected: substrateHealth,
          info: substrateHealth ? await substrateService.getChainInfo() : null,
        },
      },
    };

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Readiness check for k8s
 */
healthRouter.get('/ready', async (req, res) => {
  try {
    const [ipfsHealth, substrateHealth] = await Promise.all([
      ipfsService.healthCheck(),
      substrateService.healthCheck(),
    ]);

    if (ipfsHealth && substrateHealth) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Liveness check for k8s
 */
healthRouter.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});