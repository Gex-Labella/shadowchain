# Security Policy

## Overview

Shadow Chain implements multiple layers of security to protect user data and ensure privacy. This document outlines the security model, threat analysis, and best practices for deployment.

## Security Architecture

### 1. Encryption Model

**Per-Item Symmetric Encryption**
- Algorithm: XSalsa20-Poly1305 (libsodium crypto_secretbox)
- Key Size: 256-bit random keys per item
- Nonce: Unique 192-bit nonce per encryption operation
- Authentication: Poly1305 MAC prevents tampering

**Asymmetric Key Encryption**
- Algorithm: X25519-XSalsa20-Poly1305 (libsodium crypto_box)
- Key Derivation: From Polkadot account seed (sr25519 → X25519)
- Purpose: Encrypt symmetric keys for user-only access

### 2. Data Storage Security

**On-Chain Storage**
- Only metadata and encrypted symmetric keys stored
- No plaintext content ever touches the blockchain
- Immutable audit trail of all shadow items

**IPFS Storage**
- All content encrypted before upload
- CIDs are public but content is encrypted
- Optional pinning service authentication

### 3. Access Control

**Wallet-Based Authentication**
- Polkadot.js extension manages private keys
- Message signing for consent authorization
- No passwords or API keys in frontend

**Backend Authorization**
- Service-to-service authentication via API keys
- Rate limiting on all endpoints
- Input validation and sanitization

## Threat Model

### Threats Addressed

1. **Data Breach**: Even if IPFS nodes or database compromised, content remains encrypted
2. **Man-in-the-Middle**: TLS for all API communications, WebSocket Secure for chain connection
3. **Unauthorized Access**: Only wallet owner can decrypt their content
4. **Data Tampering**: Authenticated encryption prevents modification
5. **Key Compromise**: Per-item keys limit damage scope

### Threats NOT Addressed

1. **Compromised User Device**: If user's device is compromised, attacker has access to wallet
2. **Metadata Analysis**: On-chain transactions reveal activity patterns
3. **Social Engineering**: Users must protect their seed phrases
4. **Quantum Computing**: Current encryption not quantum-resistant

## Key Management

### User Keys
```
Seed Phrase (BIP39)
    ↓
sr25519 Keypair (Polkadot Account)
    ↓
X25519 Keypair (Encryption)
```

### Key Derivation
```typescript
// Derive encryption keypair from account seed
const encryptionKey = deriveX25519FromSr25519(accountSeed);
```

### Key Storage
- **Frontend**: Keys only in memory, never persisted
- **Backend**: No access to user private keys
- **Extension**: Polkadot.js manages key storage securely

## Best Practices

### Development
1. Never log sensitive data (keys, tokens, content)
2. Use environment variables for secrets
3. Enable strict TypeScript checks
4. Regular dependency updates

### Deployment
1. **TLS Everywhere**: Use HTTPS/WSS for all connections
2. **Secrets Management**: Use AWS Secrets Manager or similar
3. **Network Isolation**: Private subnets for backend services
4. **Monitoring**: CloudWatch alerts for suspicious activity

### Configuration
```bash
# Production .env settings
NODE_ENV=production
ENCRYPT_IN_MEMORY_ONLY=true
IPFS_GATEWAY_TIMEOUT=30000
MAX_CONTENT_SIZE=10485760  # 10MB
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=900000   # 15 minutes
```

## Incident Response

### Security Incident Checklist
1. [ ] Isolate affected systems
2. [ ] Revoke compromised API keys
3. [ ] Audit on-chain transactions
4. [ ] Notify affected users
5. [ ] Patch vulnerability
6. [ ] Post-mortem analysis

### Contact
Report security vulnerabilities to: support@locsafe.org
PGP Key: [Public key fingerprint]

## Compliance

### GDPR Considerations
- Right to erasure: Users can delete their shadow items
- Data portability: Export functionality provided
- Consent: Explicit consent required before syncing

### Data Retention
- On-chain data is immutable
- IPFS content can be unpinned (best effort)
- Backend logs retained for 30 days

## Security Checklist

### Before Production
- [ ] All dependencies updated
- [ ] Security headers configured (HSTS, CSP, etc.)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Logging excludes sensitive data
- [ ] TLS certificates valid
- [ ] Backup and recovery tested

### Regular Audits
- [ ] Monthly dependency vulnerability scan
- [ ] Quarterly penetration testing
- [ ] Annual security review
- [ ] Continuous monitoring alerts

## Cryptographic Details

### Encryption Flow
```
1. Generate random 256-bit symmetric key
2. Generate random 192-bit nonce
3. Encrypt content: crypto_secretbox(content, nonce, key)
4. Derive X25519 public key from user's Polkadot account
5. Encrypt symmetric key: crypto_box(key, nonce2, userPubKey, ephemeralKey)
6. Store: IPFS(ciphertext), Chain(encryptedKey, CID, metadata)
```

### Decryption Flow
```
1. Fetch encrypted key from chain
2. Derive X25519 private key from wallet
3. Decrypt symmetric key: crypto_box_open(encryptedKey, nonce2, userPrivKey)
4. Fetch ciphertext from IPFS using CID
5. Decrypt content: crypto_secretbox_open(ciphertext, nonce, key)
```

## Version History

- v1.0.0 - Initial security model
- v1.1.0 - Added rate limiting
- v1.2.0 - Enhanced key derivation

Last Updated: 26th October 2025