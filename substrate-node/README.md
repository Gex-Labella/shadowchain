# Shadow Chain Substrate Node

## 🎯 What Is This?

This folder contains a **custom blockchain node** built with Substrate (Polkadot's blockchain framework). Think of it as your own private blockchain server that stores encrypted references to your Web2 data.

**In Simple Terms**: This is the blockchain part of Shadow Chain - it's like a secure, tamper-proof database that only stores encrypted pointers to your data, not the data itself.

## 📚 What is Substrate?

**Substrate** is a framework for building blockchains, created by the team behind Polkadot. It's like WordPress for blockchains - it gives you pre-built components that you can customize.

**Rust** is the programming language used. Don't worry if you don't know Rust - you don't need to modify this code to use Shadow Chain!

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
│       └── service.rs      # Core node services
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
        └── lib.rs     # Combines all pallets into one blockchain
```

## 🎮 What Each Part Does

### **1. The Pallet (`pallets/shadow/`)**
This is the "smart contract" of our blockchain. It defines:
- **What data can be stored**: Shadow items (encrypted references)
- **Who can store it**: Only authorized users
- **How it's stored**: As a list linked to each user's account

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
Think of this as the blockchain's operating system. It:
- Combines all pallets (ours + system pallets)
- Sets blockchain parameters (block time, fees, etc.)
- Defines the blockchain's capabilities

### **3. The Node (`node/`)**
This is the actual software that:
- Connects to other nodes (if any)
- Produces new blocks
- Validates transactions
- Provides APIs for external apps

## 🚀 How to Run the Node

### **Option 1: Using Docker (Easiest)**
```bash
# From the project root
docker compose up substrate-node

# Or build and run directly
cd substrate-node
docker build -t shadow-substrate .
docker run -p 9944:9944 -p 9933:9933 shadow-substrate
```

### **Option 2: Native Build (Advanced)**
```bash
# Install Rust first
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install dependencies
sudo apt-get install -y clang libclang-dev protobuf-compiler

# Build the node
cd substrate-node
cargo build --release

# Run the node
./target/release/shadowchain-node --dev
```

## 🔌 How to Connect to the Node

### **WebSocket Endpoint**
- **Local**: `ws://localhost:9944`
- **Docker**: `ws://localhost:9944`

### **HTTP RPC Endpoint**
- **Local**: `http://localhost:9933`
- **Docker**: `http://localhost:9933`

### **Using Polkadot.js Apps (Web Interface)**
1. Go to: https://polkadot.js.org/apps
2. Click top-left corner to change network
3. Select "Development" → "Local Node"
4. Or use custom endpoint: `ws://localhost:9944`

## 📊 What Gets Stored On-Chain?

**Important**: We NEVER store your actual data on the blockchain!

Each **Shadow Item** contains:
```javascript
{
  id: "unique-hash-id",           // Unique identifier
  cid: "QmXk2f9...",              // IPFS address of encrypted content
  encryptedKey: "0x7f9a2b...",    // Encrypted key (only you can decrypt)
  timestamp: 1699234567,          // When it was stored
  source: "GitHub",               // Or "Twitter"
  metadata: "commit: fix bug",    // Brief description
  deleted: false                  // Soft delete flag
}
```

## 🔐 Security Model

1. **Your Keys, Your Data**: Only you have the keys to decrypt your content
2. **Encrypted Storage**: Content is encrypted before leaving your device
3. **Distributed Storage**: Actual content on IPFS, only pointers on-chain
4. **Consent-Based**: Node only accepts data with valid user consent

## 🛠️ Development Commands

### **Run Tests**
```bash
cd substrate-node
cargo test
```

### **Check Code**
```bash
cargo check
```

### **Format Code**
```bash
cargo fmt
```

### **Clean Build**
```bash
cargo clean
cargo build --release
```

## 📡 Interacting with the Node

### **From JavaScript/TypeScript**
```javascript
import { ApiPromise, WsProvider } from '@polkadot/api';

// Connect
const wsProvider = new WsProvider('ws://localhost:9944');
const api = await ApiPromise.create({ provider: wsProvider });

// Query shadow items
const items = await api.query.shadowPallet.shadowItems('user-address');

// Submit new item
const tx = api.tx.shadowPallet.submitShadowItem(
  cid,
  encryptedKey,
  'GitHub',
  metadata
);
await tx.signAndSend(account);
```

### **Using curl**
```bash
# Get node info
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
  http://localhost:9933
```

## ⚙️ Configuration Files

### **Chain Spec (`chain_spec.rs`)**
Defines:
- Network name: "Shadow Chain"
- Initial accounts (Alice, Bob for testing)
- Initial token distribution
- Genesis configuration

### **Runtime Configuration (`runtime/lib.rs`)**
Sets:
- Block time: 6 seconds
- Currency: SHDW tokens
- Transaction fees
- Pallet configurations

## 🐛 Troubleshooting

### **Node Won't Start**
- Check ports 9944, 9933 aren't in use: `lsof -i :9944`
- Ensure Docker is running: `docker ps`
- Check logs: `docker compose logs substrate-node`

### **Can't Connect from Frontend**
- Verify node is running: `curl http://localhost:9933`
- Check WebSocket: `websocat ws://localhost:9944`
- Ensure no firewall blocking ports

### **Build Errors**
- Update Rust: `rustup update`
- Clear cache: `cargo clean`
- Check Rust version: `rustc --version` (need 1.70+)

## 📚 Key Concepts for Beginners

### **What's a Pallet?**
A pallet is like a module or plugin that adds specific functionality to your blockchain. Our "shadow" pallet adds the ability to store encrypted data references.

### **What's an Extrinsic?**
An extrinsic is a blockchain transaction - a request to change the blockchain state. Like calling `submitShadowItem()`.

### **What's Storage?**
On-chain storage is the blockchain's database. We store minimal data here (just references) to keep the chain lightweight.

### **What's a Block?**
A block is a batch of transactions bundled together. Our node creates a new block every 6 seconds.

### **What's Consensus?**
Consensus is how nodes agree on the blockchain state. In dev mode, we use "Instant Seal" (no consensus needed). In production, you'd use proof-of-authority or proof-of-stake.

## 🚦 Node Status Indicators

When running, you'll see logs like:
```
💤 Idle (0 peers)          # Waiting for transactions
⚙️  Preparing 0.0 bps      # Processing transactions  
✨ Imported #123           # New block created
🔍 Discovered: 0 peers     # Network status
```

## 📖 Learn More

- **Substrate Docs**: https://docs.substrate.io
- **Polkadot.js Docs**: https://polkadot.js.org/docs/
- **Rust Book**: https://doc.rust-lang.org/book/
- **Our Docs**: See `/docs/arch.md` for architecture details

## 🆘 Getting Help

1. Check the logs: `docker compose logs substrate-node`
2. Verify the node is running: `docker ps`
3. Test the connection: `curl http://localhost:9933`
4. Check our troubleshooting guide above

Remember: You don't need to understand all the Rust code to use Shadow Chain! The node just needs to be running for the system to work.