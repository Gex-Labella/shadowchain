/**
 * Backend configuration management
 */

import dotenv from 'dotenv';
import { Level } from 'pino';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  port: number;
  cors: {
    origin: string;
    credentials: boolean;
  };
  
  // Substrate
  substrateWsUrl: string;
  chainTypes: any;
  
  // IPFS
  ipfsApiUrl: string;
  ipfsGatewayUrl: string;
  pinningService: 'local' | 'web3storage' | 'pinata';
  web3StorageToken?: string;
  pinataApiKey?: string;
  pinataSecretKey?: string;
  
  // GitHub (Legacy - centralized approach)
  githubToken: string;
  githubRepos: string[];
  
  // GitHub OAuth (New - user connections)
  githubClientId: string;
  githubClientSecret: string;
  githubCallbackUrl: string;
  
  // Twitter
  twitterBearerToken: string;
  twitterUserId: string;
  
  // Fetcher
  fetchIntervalMinutes: number;
  maxItemsPerSync: number;
  
  // Security
  encryptInMemoryOnly: boolean;
  maxContentSize: number;
  rateLimitRequests: number;
  rateLimitWindow: number;
  
  // Logging
  logLevel: Level;
  logFormat: 'json' | 'pretty';
  
  // Database (optional)
  databaseUrl?: string;
  useDatabaseIndexing: boolean;
  
  // Development
  isDevelopment: boolean;
  enableDebugEndpoints: boolean;
  mockExternalApis: boolean;
}

const config: Config = {
  // Server
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  
  // Substrate
  substrateWsUrl: process.env.SUBSTRATE_WS || 'ws://localhost:9944',
  chainTypes: process.env.SUBSTRATE_TYPES_BUNDLE ? 
    JSON.parse(process.env.SUBSTRATE_TYPES_BUNDLE) : {},
  
  // IPFS
  ipfsApiUrl: process.env.IPFS_API_URL || 'http://localhost:5001',
  ipfsGatewayUrl: process.env.IPFS_GATEWAY_URL || 'http://localhost:8080',
  pinningService: (process.env.PINNING_SERVICE || 'local') as 'local' | 'web3storage' | 'pinata',
  web3StorageToken: process.env.WEB3_STORAGE_TOKEN,
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretKey: process.env.PINATA_SECRET_KEY,
  
  // GitHub (Legacy - centralized approach)
  githubToken: process.env.GITHUB_TOKEN || '',
  githubRepos: process.env.GITHUB_REPOS?.split(',').map(r => r.trim()) || [],
  
  // GitHub OAuth (New - user connections)
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
  
  // Twitter
  twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  twitterUserId: process.env.TWITTER_USER_ID || '',
  
  // Fetcher
  fetchIntervalMinutes: parseInt(process.env.FETCH_INTERVAL_MINUTES || '15', 10),
  maxItemsPerSync: parseInt(process.env.MAX_ITEMS_PER_SYNC || '50', 10),
  
  // Security
  encryptInMemoryOnly: process.env.ENCRYPT_IN_MEMORY_ONLY === 'true',
  maxContentSize: parseInt(process.env.MAX_CONTENT_SIZE || '10485760', 10), // 10MB
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  
  // Logging
  logLevel: (process.env.LOG_LEVEL || 'info') as Level,
  logFormat: (process.env.LOG_FORMAT || 'json') as 'json' | 'pretty',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  useDatabaseIndexing: process.env.USE_DATABASE_INDEXING === 'true',
  
  // Development
  isDevelopment: process.env.NODE_ENV !== 'production',
  enableDebugEndpoints: process.env.ENABLE_DEBUG_ENDPOINTS === 'true',
  mockExternalApis: process.env.MOCK_EXTERNAL_APIS === 'true',
};

// Validate required configuration
export function validateConfig(): void {
  const required = [
    { key: 'githubToken', value: config.githubToken },
    { key: 'twitterBearerToken', value: config.twitterBearerToken },
  ];
  
  const missing = required.filter(({ value }) => !value);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.map(m => m.key).join(', ')}`
    );
  }
  
  // Validate pinning service credentials
  if (config.pinningService === 'web3storage' && !config.web3StorageToken) {
    throw new Error('WEB3_STORAGE_TOKEN required when using web3storage pinning');
  }
  
  if (config.pinningService === 'pinata' && (!config.pinataApiKey || !config.pinataSecretKey)) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY required when using pinata pinning');
  }
}

export default config;