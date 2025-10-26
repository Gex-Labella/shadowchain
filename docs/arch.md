# Shadow Chain Architecture

## System Overview

Shadow Chain is a privacy-preserving Web2-to-Web3 bridge that automatically mirrors user activity from GitHub and Twitter/X to a personal blockchain with encrypted storage.

## Core Components

### 1. Substrate Node
Custom Polkadot SDK blockchain with `pallet-shadow` for storing encrypted metadata and IPFS references.

### 2. Backend Services
- **Fetcher Service**: Polls Web2 APIs and orchestrates encryption/storage (supports OAuth and centralized approaches)
- **REST API**: Provides frontend access to shadow items
- **IPFS Client**: Manages encrypted content storage
- **OAuth Service**: Manages user OAuth connections for GitHub (X/Twitter coming soon)

### 3. Frontend Application
React-based dashboard for wallet connection, consent management, and content decryption.

### 4. Shared Crypto Library
TypeScript implementation of libsodium-based encryption/decryption.

## Sequence Diagrams

### 1. Initial Setup and Consent Flow

```
User            Frontend         Polkadot.js      Backend          Substrate
 │                 │                  │               │                │
 │──Connect────────►                 │               │                │
 │                 │──Get Account─────►               │                │
 │                 │◄─Address─────────               │                │
 │                 │                  │               │                │
 │──Authorize──────►                 │               │                │
 │                 │──Sign Message────►               │                │
 │                 │◄─Signature───────               │                │
 │                 │                  │               │                │
 │                 │──────Submit Consent Extrinsic────────────────────►
 │                 │◄─────────────Consent Stored──────────────────────
 │◄─Authorized─────                  │               │                │
```

### 2. Fetcher Flow (GitHub Example)

```
Fetcher         GitHub API      Crypto Module      IPFS          Substrate
  │                 │                 │              │                │
  │──Get Commits────►                │              │                │
  │◄──Commit Data───                 │              │                │
  │                 │                 │              │                │
  │──Format JSON────┐                │              │                │
  │                 │                 │              │                │
  │──Encrypt Content─────────────────►              │                │
  │◄──Encrypted Payload──────────────               │                │
  │                 │                 │              │                │
  │──Upload Ciphertext───────────────────────────────►               │
  │◄──CID────────────────────────────────────────────               │
  │                 │                 │              │                │
  │──Submit Shadow Item Extrinsic────────────────────────────────────►
  │◄─────────────────────Event Emitted───────────────────────────────
```

### 3. GitHub OAuth Flow 

```
User          Frontend        Backend         GitHub OAuth      Storage
 │               │               │                  │              │
 │──Connect GitHub►              │                  │              │
 │               │──Request Auth─►                  │              │
 │               │◄─Auth URL─────                   │              │
 │               │               │                  │              │
 │◄─Redirect──────              │                  │              │
 │────────────────────Authorize─────────────────────►              │
 │◄───────────────────Redirect + Code───────────────               │
 │               │               │                  │              │
 │               │──Code─────────►                  │              │
 │               │               │──Exchange Code────►              │
 │               │               │◄─Access Token─────              │
 │               │               │                  │              │
 │               │               │──Store Token──────────────────────►
 │               │               │◄─Token Stored─────────────────────
 │               │◄─Success──────                   │              │
 │◄─Connected─────               │                  │              │
```

### 4. Encryption Flow

```
Content         Crypto Module        User Public Key      Result
  │                  │                     │                │
  │──Plain Text──────►                    │                │
  │                  │                     │                │
  │                  ├─Generate Symmetric Key              │
  │                  │     (256-bit)                       │
  │                  │                     │                │
  │                  ├─Encrypt Content                     │
  │                  │  (XSalsa20-Poly1305)               │
  │                  │                     │                │
  │                  ├─Get User Pub Key────►               │
  │                  │◄────X25519 Key──────                │
  │                  │                     │                │
  │                  ├─Encrypt Symmetric Key               │
  │                  │  (crypto_box)                       │
  │                  │                     │                │
  │                  │                     ├─Ciphertext────►
  │                  │                     ├─Encrypted Key─►
  │                  │                     ├─Nonce─────────►
```

### 5. IPFS Pinning Flow

```
Backend          IPFS Node        Web3.Storage       Result
  │                 │                  │               │
  │──Add Content────►                 │               │
  │◄──CID───────────                  │               │
  │                 │                  │               │
  │──Pin Locally────►                 │               │
  │◄──Pinned────────                  │               │
  │                 │                  │               │
  │──Remote Pin Request───────────────►               │
  │◄──Pin Status───────────────────────               │
  │                 │                  │               │
  │                 │                  ├─Distributed──►
```

### 6. Frontend Decrypt Flow

```
User          Frontend       Polkadot.js     Substrate      IPFS       Crypto
 │               │               │              │            │           │
 │──View Item────►               │              │            │           │
 │               │──Get Shadow Item─────────────►            │           │
 │               │◄──CID, Encrypted Key─────────            │           │
 │               │               │              │            │           │
 │               │──Fetch Content───────────────────────────►           │
 │               │◄──Ciphertext─────────────────────────────           │
 │               │               │              │            │           │
 │──Decrypt──────►               │              │            │           │
 │               │──Get Private Key─►           │            │           │
 │               │◄─Sign Request────            │            │           │
 │               │               │              │            │           │
 │               │──Decrypt Symmetric Key────────────────────────────────►
 │               │◄──Plain Key───────────────────────────────────────────
 │               │               │              │            │           │
 │               │──Decrypt Content──────────────────────────────────────►
 │               │◄──Plain Content───────────────────────────────────────
 │◄─Display───────               │              │            │           │
```

## Data Models

### On-Chain Storage

```rust
pub struct ShadowItem {
    pub id: H256,
    pub cid: Vec<u8>,              // IPFS Content ID
    pub encrypted_key: Vec<u8>,     // Encrypted symmetric key
    pub timestamp: u64,
    pub source: Source,             // GitHub or Twitter
    pub metadata: BoundedVec<u8>,   // Optional metadata
}

pub enum Source {
    GitHub,
    Twitter,
}
```

### Off-Chain Encrypted Payload

```typescript
interface EncryptedPayload {
  ciphertext: Uint8Array;    // Encrypted content
  nonce: Uint8Array;         // Encryption nonce
  ephemeralPublicKey?: Uint8Array; // For crypto_box
}

interface ShadowContent {
  source: 'github' | 'twitter';
  url: string;
  body: string;
  timestamp: number;
  raw_meta: Record<string, any>;
}
```

## API Endpoints

### REST API

```
GET  /api/health
GET  /api/shadow/items/:address
POST /api/shadow/sync
GET  /api/shadow/consent/:address

# OAuth Endpoints
POST /api/auth/github/connect
GET  /api/auth/github/callback
GET  /api/auth/connections/:address
DELETE /api/auth/connections/:address/:service
GET  /api/auth/github/status/:address
```

### WebSocket RPC

```
shadow.getShadowItems(accountId): Vec<ShadowItem>
shadow.getItemCount(accountId): u32
```

## Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    UNTRUSTED ZONE                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   GitHub    │  │  Twitter/X   │  │     IPFS     │  │
│  │     API     │  │     API      │  │   Network    │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   DMZ Zone     │
                    │   (Backend)    │
                    │  Encryption    │
                    │  Validation    │
                    └───────┬────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    TRUSTED ZONE                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Substrate  │  │   Frontend   │  │ Polkadot.js  │  │
│  │    Node     │  │  (Browser)   │  │  Extension   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
- Backend services can be replicated behind load balancer
- IPFS cluster for redundancy
- Read replicas for chain state

### Performance Optimizations
- Batch processing for fetcher
- Caching layer for frequently accessed items  
- CDN for frontend assets

### Storage Limits
- On-chain: ~1KB per shadow item (metadata only)
- IPFS: Configurable max content size (default 10MB)
- Pruning: Optional time-based expiry

## Monitoring and Observability

### Metrics
- Fetcher sync latency
- IPFS upload success rate
- Chain extrinsic success/failure
- API response times

### Logs
- Structured JSON logging
- Correlation IDs for request tracing
- No sensitive data in logs

### Alerts
- Failed sync attempts
- High error rates
- Chain connection issues
- IPFS availability

## Disaster Recovery

### Backup Strategy
- Chain state: Regular snapshots
- IPFS content: Pinning service redundancy
- Configuration: Version controlled

### Recovery Procedures
1. Restore chain from snapshot
2. Re-pin IPFS content from backup pins
3. Replay failed syncs from queue

## OAuth Implementation Details

### Token Storage
- OAuth tokens are stored in memory (demo) or encrypted database (production)
- Tokens are associated with user's Polkadot address
- No raw tokens are exposed via API

### Multi-User Support
- Fetcher service checks for user-specific OAuth tokens
- Falls back to centralized approach if no token exists
- Each user's repositories are fetched independently

### Security Considerations
- OAuth state parameter for CSRF protection
- Tokens encrypted at rest
- Automatic token validation before use
- Revocation support

## Future Enhancements

### Phase 2
- Support for additional platforms (LinkedIn, Reddit, X/Twitter OAuth)
- Selective sync filters
- Social recovery for encryption keys
- OAuth token refresh automation

### Phase 3
- Cross-chain bridges
- Decentralized fetcher network
- Zero-knowledge proofs for private queries
- Federated OAuth providers