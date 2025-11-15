/**
 * Environment configuration for the frontend
 */

export const config = {
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    timeout: 30000,
  },
  ws: {
    url: process.env.REACT_APP_WS_URL,
  },
  github: {
    clientId: process.env.REACT_APP_GITHUB_CLIENT_ID || '',
  },
  features: {
    mockMode: process.env.REACT_APP_MOCK_MODE,
  },
  ipfs: {
    gateway: process.env.REACT_APP_IPFS_GATEWAY || 'https://ipfs.io/ipfs',
  },
} as const;

// Validate required environment variables
if (!config.github.clientId && process.env.NODE_ENV === 'production') {
  console.error('Missing required environment variable: REACT_APP_GITHUB_CLIENT_ID');
}