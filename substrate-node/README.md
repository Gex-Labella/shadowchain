# Shadow Chain Parachain Node

## 🎯 What Is This?

This folder contains a **Polkadot parachain node** built with Substrate and Cumulus. It's configured to run as a parachain that can connect to Polkadot or Kusama relay chains. The node stores encrypted references to your Web2 data on-chain.

**In Simple Terms**: This is the blockchain part of Shadow Chain - a parachain that provides a secure, tamper-proof database storing only encrypted pointers to your data, not the data itself.

## 📚 What is a Parachain?

A **Parachain** is a blockchain that connects to and gains security from the Polkadot relay chain. Benefits include:
- Shared security from Polkadot
- Cross-chain messaging (XCM) capabilities
- Interoperability with other parachains
- No need to maintain your own validator set

**Cumulus** is the framework that makes a Substrate chain compatible with Polkadot.

## 🏗️ Folder Structure Explained

```
substrate-node/
│
├── Cargo.toml           # 📦 Main package file (like package.json for Rust)
├── Dockerfile          # 🐳 Instructions to build a Docker container
│
├── node/               # 💻 The actual blockchain node software
│   ├── Cargo.toml     # Package configuration for the node
│   ├── build.rs       # Build script (runs during compilation)
│   └── src/
│       ├── main.rs         # Entry point - starts the node
│       ├── chain_spec.rs   # Network configuration & genesis state
│       ├── cli.rs          # Command-line interface
│       ├── command.rs      # Command processing
│       ├── rpc.rs          # API endpoints
│       └── service.rs      # Core node services with Cumulus integration
│
├── pallets/           # 🔧 Custom blockchain logic (smart contracts)
│   └── shadow/       # Our custom "Shadow" pallet
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Main pallet logic
│           ├── mock.rs         # Test environment setup
│           ├── tests.rs        # Unit tests
│           └── benchmarking.rs # Performance tests
│
└── runtime/           # ⚙️ Blockchain configuration
    ├── Cargo.toml
    ├── build.rs
    └── src/
        ├── lib.rs          # Runtime with parachain support
        ├── configs.rs      # Pallet configurations
        ├── xcm_config.rs   # Cross-chain messaging setup
        └── apis.rs         # Runtime APIs
```

## 🎮 What Each Part Does

### **1. The Shadow Pallet (`pallets/shadow/`)**
This is the custom logic of our parachain. It defines:
- **What data can be stored**: Shadow items (encrypted references with bounded storage)
- **Who can store it**: Only authorized users with valid accounts
- **How it's stored**: Using BoundedVec with configurable limits per account

**Key Functions**:
```rust
// Stores a new encrypted item on the blockchain
submit_shadow_item(cid, encrypted_key, source, metadata)

// Marks an item as deleted
delete_shadow_item(item_id)

// Records user consent for data processing
grant_consent(message_hash, expires_in)

// Revokes consent
revoke_consent()
```

### **2. The Runtime (`runtime/`)**
The parachain runtime includes:
- Cumulus pallets for parachain functionality
- XCM configuration for cross-chain messaging
- Shadow pallet with proper storage bounds
- All necessary parachain system pallets

### **3. The Node (`node/`)**
The collator node software that:
- Collects transactions and produces blocks
- Communicates with the relay chain
- Validates parachain blocks
- Provides APIs for external apps

## 🚀 How to Run the Node

### **Option 1: Using Docker (Recommended)**
```bash
# From the project root
docker compose up substrate-node

# Or build and run directly
cd substrate-node
docker build -t shadow-parachain .
docker run -p 9944:9944 -p 9933:9933 -p 30333:30333 shadow-parachain
```

### **Option 2: Local Development Mode**
```bash
# Run as a standalone chain (development)
./target/release/shadowchain-node --dev

# Run as a parachain collator
./target/release/shadowchain-node \
  --collator \
  --parachain-id 2000 \
  --base-path /tmp/parachain \
  --port 30333 \
  --rpc-port 9933 \
  --ws-port 9944 \
  -- \
  --chain rococo \
  --port 30334 \
  --rpc-port 9934 \
  --ws-port 9945
```

## 🔌 Parachain Configuration

### **Chain Specifications**
- **Parachain ID**: Configurable (default: 2000 for testing)
- **Relay Chain**: Compatible with Polkadot/Kusama/Rococo
- **Runtime**: WASM-based with Cumulus integration
- **Consensus**: Aura (for block authoring) + relay chain consensus

### **XCM Support**
The parachain supports Cross-Consensus Messaging (XCM) for:
- Asset transfers between parachains
- Remote execution of functions
- Communication with relay chain

## 📊 What Gets Stored On-Chain?

**Important**: We NEVER store your actual data on the blockchain!

Each **Shadow Item** contains:
```rust
{
  id: Hash,                      // Unique identifier
  owner: AccountId,              // Account that owns this item
  cid: BoundedVec<u8, 100>,     // IPFS CID (max 100 bytes)
  encrypted_key: BoundedVec<u8, 512>, // Encrypted key (max 512 bytes)
  timestamp: u64,                // When it was stored
  source: BoundedVec<u8, 50>,   // Source platform (max 50 bytes)
  metadata: BoundedVec<u8, 200>, // Brief description (max 200 bytes)
  deleted: bool                  // Soft delete flag
}
```

**Storage Limits**:
- Max CID length: 100 bytes
- Max encrypted key: 512 bytes
- Max source name: 50 bytes
- Max metadata: 200 bytes
- Max items per account: 10,000 (configurable)

## 🔐 Security Model

1. **Parachain Security**: Inherits security from Polkadot relay chain
2. **Your Keys, Your Data**: Only you have the keys to decrypt your content
3. **Encrypted Storage**: Content is encrypted before leaving your device
4. **Distributed Storage**: Actual content on IPFS, only pointers on-chain
5. **Consent-Based**: Node only accepts data with valid user consent
6. **Bounded Storage**: Prevents storage attacks with size limits

## 🛠️ Development Commands

### **Build for Production**
```bash
cd substrate-node
cargo build --release --features on-chain-release-build
```

### **Run Tests**
```bash
cargo test --all
```

### **Benchmarking**
```bash
cargo build --release --features runtime-benchmarks
./target/release/shadowchain-node benchmark pallet \
  --chain dev \
  --pallet pallet_shadow \
  --extrinsic "*" \
  --steps 50 \
  --repeat 20
```

## 📡 Interacting with the Parachain

### **From JavaScript/TypeScript**
```javascript
import { ApiPromise, WsProvider } from '@polkadot/api';

// Connect to parachain
const wsProvider = new WsProvider('ws://localhost:9944');
const api = await ApiPromise.create({ provider: wsProvider });

// Check parachain info
const parachainId = await api.query.parachainInfo.parachainId();
console.log('Parachain ID:', parachainId.toString());

// Query shadow items
const items = await api.query.shadow.shadowItems(accountId);

// Submit new item with bounded data
const tx = api.tx.shadow.submitShadowItem(
  cid,          // max 100 bytes
  encryptedKey, // max 512 bytes
  'GitHub',     // max 50 bytes
  metadata      // max 200 bytes
);
await tx.signAndSend(account);
```

## ⚙️ Configuration Details

### **Parachain-Specific Configurations**
- **Collator Selection**: Manages block producers
- **XCM Config**: Cross-chain messaging settings
- **ParachainSystem**: Validation and relay chain interaction
- **ParachainInfo**: Stores parachain ID and metadata

### **Runtime Parameters**
- Block time: 12 seconds (2x relay chain)
- Currency: SHDW tokens
- Transaction fees: Dynamic based on weight
- Max block weight: 50% of relay chain block

## 🚦 Parachain Status Indicators

When running as a collator:
```
🏆 Starting collator node
⚙️  Syncing relay chain (Rococo)
📦 Imported relay block #1234
✨ Produced parachain block #567
🔗 Block included in relay chain
```

## 🐛 Troubleshooting

### **Collator Won't Start**
- Ensure relay chain is accessible
- Check parachain ID is registered
- Verify ports aren't blocked
- Check both parachain and relay chain ports

### **XCM Errors**
- Verify XCM configuration
- Check asset registration
- Ensure proper weights configured

### **Storage Errors**
- Check BoundedVec limits
- Ensure data fits within bounds
- Verify account has not hit item limit

## 📖 Learn More

- **Polkadot Wiki**: https://wiki.polkadot.network/docs/build-parachain
- **Cumulus Docs**: https://github.com/paritytech/cumulus
- **XCM Format**: https://github.com/paritytech/xcm-format
- **Substrate Docs**: https://docs.substrate.io

## 🆘 Getting Help

1. Check collator logs: `docker compose logs substrate-node`
2. Verify relay chain connection
3. Test parachain APIs: `curl http://localhost:9933`
4. Check XCM configuration if cross-chain features fail

Remember: The node is now configured as a parachain with full Cumulus support, XCM messaging, and proper storage bounds for production use!