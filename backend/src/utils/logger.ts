/**
 * Logger configuration for the backend
 */

import pino from 'pino';
import config from '../config';

const logger = pino({
  level: config.logLevel,
  transport: config.isDevelopment && config.logFormat === 'pretty' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    pid: process.pid,
    service: 'shadowchain-backend',
  },
});

// Child loggers for specific modules
export const apiLogger = logger.child({ module: 'api' });
export const fetcherLogger = logger.child({ module: 'fetcher' });
export const ipfsLogger = logger.child({ module: 'ipfs' });
export const substrateLogger = logger.child({ module: 'substrate' });
export const authLogger = logger.child({ module: 'auth' });
export const cryptoLogger = logger.child({ module: 'crypto' });
export const oauthLogger = logger.child({ module: 'oauth' });
export const twitterLogger = logger.child({ module: 'twitter' });
export const dbLogger = logger.child({ module: 'database' });

export default logger;