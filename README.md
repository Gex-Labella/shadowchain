# Shadow Chain

A production-ready full-stack project that mirrors your Web2 activity (GitHub commits and Twitter/X posts) into a private, user-owned Polkadot/Substrate blockchain with encrypted IPFS storage.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USER BROWSER                                  │
│  ┌─────────────────┐                                         ┌────────────────┐ │
│  │ React Frontend  │                                         │ Polkadot.js    │ │
│  │ (TypeScript)    │◄────────── Wallet Connect ────────────► │ Extension      │ │
│  └────────┬────────┘                                         └────────────────┘ │
└───────────┼─────────────────────────────────────────────────────────────────────┘
            │
            │ HTTPS/WSS
            │
┌───────────▼───────────────────────────────────────────────────────────────────┐
│                                  BACKEND SERVICES                             │
│  ┌─────────────────┐     ┌──────────────────┐     ┌────────────────────────┐  │
│  │  REST API       │     │  Fetcher Service │     │  IPFS Integration      │  │
│  │  (Express.js)   │     │  - GitHub        │     │  - Upload ciphertext   │  │
│  │                 │◄────┤  - Twitter/X     │────►│  - Pin management      │  │
│  └─────────────────┘     │  - Encryption    │     │  - CID retrieval       │  │
│                          └──────────────────┘     └─────────┬──────────────┘  │
└──────────────────────────────────────┬──────────────────────┼─────────────────┘
                                       │                      │
                           Extrinsics  │                      │ Store encrypted
                           Submit      │                      │ content
                                       ▼                      ▼
┌─────────────────────────────────────────────┐    ┌────────────────────────────┐
│          SUBSTRATE NODE                     │    │       IPFS NETWORK         │
│  ┌───────────────────────────────────────┐  │    │  ┌──────────────────────┐  │
│  │  Runtime                              │  │    │  │  Encrypted Payloads  │  │
│  │  - pallet-shadow                      │  │    │  │  - GitHub commits    │  │
│  │  - Storage: ShadowItems               │  │    │  │  - Twitter posts     │  │
│  │  - Extrinsics: submit_shadow_item     │  │    │  │  - Media attachments │  │
│  └───────────────────────────────────────┘  │    │  └──────────────────────┘  │
└─────────────────────────────────────────────┘    └────────────────────────────┘
```

## Data Flow

1. **Fetcher Service** polls GitHub and Twitter APIs for new content
   - Supports both centralized approach (configured API keys) and OAuth (user connections)
2. **Encryption**:
   - Generate per-item symmetric key (XSalsa20-Poly1305)
   - Encrypt content with symmetric key
   - Encrypt symmetric key with user's public key
3. **IPFS Storage**: Upload encrypted content, get CID
4. **On-chain**: Submit CID + encrypted symmetric key via extrinsic
5. **Frontend**: Decrypt symmetric key with wallet, fetch from IPFS, decrypt content

## Security Model

- **Zero-knowledge**: Backend never sees unencrypted content
- **User sovereignty**: Only the wallet owner can decrypt their data
- **Immutable audit trail**: All activity is recorded on-chain
- **Distributed storage**: Content stored on IPFS network

## Prerequisites

- Node.js 18.x LTS or later
- Docker and Docker Compose
- AWS CLI (for deployment)
- Terraform (for infrastructure)
- Polkadot.js browser extension

> **Note**: The Substrate node builds with custom pallet-shadow using Polkadot SDK v1.0.0. Build times may be long on first run.

## Quick Start (Local Development)

1. **Clone and setup**:
```bash
git clone https://github.com/tufstraka/shadowchain.git
cd shadowchain
make install-deps
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your API keys:
# - GITHUB_TOKEN (optional - for centralized approach)
# - TWITTER_BEARER_TOKEN
# - GITHUB_CLIENT_ID (for OAuth)
# - GITHUB_CLIENT_SECRET (for OAuth)
```

**Setting up GitHub OAuth App**:
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: Shadow Chain
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3001/api/auth/github/callback
4. Copy Client ID and Secret to `.env`

3. **Start local services**:
```bash
make dev
# This starts:
# - Substrate node (port 9944)
# - IPFS node (port 5001)
# - Backend API (port 3001)
# - Frontend (port 3000)
```

4. **Connect wallet**:
- Open http://localhost:3000
- Connect Polkadot.js extension
- Sign authorization consent

5. **Connect GitHub account** (optional):
- Go to Dashboard
- Click "Connect" next to GitHub
- Authorize Shadow Chain to access your repositories
- Your repos will now be synced automatically

5. **Test sync**:
```bash
# Run manual sync
make sync-demo
```

## Production Deployment (AWS)

### Prerequisites
- AWS Account with appropriate permissions
- Domain name (optional, for TLS)
- API Keys configured in AWS Secrets Manager

### Deploy Steps

1. **Build Docker images**:
```bash
make build-prod
```

2. **Configure AWS**:
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit with your AWS configuration
```

3. **Deploy infrastructure**:
```bash
make deploy-aws
# This will:
# - Create VPC, subnets, security groups
# - Deploy ECS Fargate services
# - Setup RDS Postgres (optional)
# - Configure S3 for frontend hosting
# - Setup IPFS cluster or web3.storage integration
```

4. **Update DNS** (if using custom domain):
- Point your domain to the ALB/CloudFront distribution
- Update CORS settings if needed

## Project Structure

```
/
├── README.md                 # This file
├── frontend/                 # React TypeScript application
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── backend/                  # Node.js backend services
│   ├── src/
│   │   ├── api/             # REST API
│   │   ├── fetcher/         # GitHub/Twitter fetcher
│   │   ├── ipfs/            # IPFS integration
│   │   └── substrate/       # Chain interaction
│   ├── Dockerfile
│   └── package.json
├── substrate-node/           # Custom Substrate blockchain
│   ├── pallets/
│   │   └── shadow/          # Shadow pallet
│   ├── runtime/
│   ├── node/
│   └── Cargo.toml
├── shared-crypto/            # Shared encryption library
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── infra/                    # Infrastructure as Code
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       └── modules/
├── .github/workflows/        # CI/CD pipelines
│   ├── build.yml
│   ├── test.yml
│   └── deploy.yml
├── scripts/                  # Utility scripts
│   ├── dev_local.sh
│   ├── deploy_aws.sh
│   └── run_e2e_local.sh
├── docs/                     # Additional documentation
│   ├── arch.md              # Architecture details
│   └── security.md          # Security considerations
├── docker-compose.yml        # Local development setup
├── Makefile                  # Common commands
└── .env.example             # Environment variables template
```

## API Reference

### Backend REST API

- `GET /api/health` - Health check
- `GET /api/shadow/items/:address` - Get shadow items for address
- `POST /api/shadow/sync` - Trigger manual sync
- `GET /api/shadow/consent/:address` - Check consent status

**OAuth Endpoints (New)**:
- `POST /api/auth/github/connect` - Initialize GitHub OAuth flow
- `GET /api/auth/github/callback` - OAuth callback handler
- `GET /api/auth/connections/:address` - Get user's connected accounts
- `DELETE /api/auth/connections/:address/:service` - Revoke connection
- `GET /api/auth/github/status/:address` - Check GitHub connection status

### Substrate Extrinsics

- `shadowPallet.submitShadowItem(cid, encryptedKey, metadata)` - Store shadow item
- `shadowPallet.revokeConsent()` - Revoke sync consent

### Shared Crypto Module

```typescript
// Encryption
encryptContent(content: string, userPublicKey: Uint8Array): EncryptedPayload
// Decryption  
decryptContent(encrypted: EncryptedPayload, userPrivateKey: Uint8Array): string
```

## Testing

```bash
# Unit tests
make test

# E2E tests
make test-e2e

# Test with coverage
make test-coverage
```

## Environment Variables

See `.env.example` for full list. Key variables:

**API Keys (Centralized Approach)**:
- `GITHUB_TOKEN` - GitHub Personal Access Token (optional)
- `TWITTER_BEARER_TOKEN` - Twitter API v2 Bearer Token

**OAuth Configuration (User Connections)**:
- `GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret
- `GITHUB_CALLBACK_URL` - OAuth callback URL

**Infrastructure**:
- `IPFS_API_URL` - IPFS node endpoint
- `SUBSTRATE_WS` - Substrate node WebSocket endpoint
- `PINNING_SERVICE` - 'local' | 'web3storage' | 'pinata'

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Security

See [SECURITY.md](./SECURITY.md) for security policy and vulnerability reporting.

## License

see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Polkadot/Substrate team for the blockchain framework
- IPFS team for distributed storage
- libsodium for encryption primitives