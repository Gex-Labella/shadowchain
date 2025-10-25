#!/bin/bash

# Shadow Chain Demo Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}╔════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║       Shadow Chain - Live Demo             ║${NC}"
echo -e "${PURPLE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Function to simulate typing
type_text() {
    text="$1"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep 0.03
    done
    echo ""
}

# Function to wait for user
wait_for_user() {
    echo ""
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read -r
}

# Start demo
echo -e "${CYAN}Welcome to Shadow Chain!${NC}"
echo -e "${CYAN}Your Web2 activity, secured on Web3${NC}"
echo ""
type_text "Let's see how Shadow Chain works..."
wait_for_user

# Step 1: Check services
echo -e "${BLUE}📍 Step 1: Checking Shadow Chain Services${NC}"
echo ""
type_text "Shadow Chain consists of multiple services working together:"
echo ""
echo -e "  ${GREEN}✓${NC} Substrate Blockchain - Your private chain"
echo -e "  ${GREEN}✓${NC} IPFS Network - Distributed storage for encrypted content"
echo -e "  ${GREEN}✓${NC} Backend Service - Fetches and encrypts your Web2 data"
echo -e "  ${GREEN}✓${NC} React Frontend - Your control panel"
wait_for_user

# Step 2: Simulate GitHub commit fetch
echo -e "${BLUE}📍 Step 2: Fetching GitHub Activity${NC}"
echo ""
type_text "Fetching your latest GitHub commits..."
echo ""
cat << 'EOF'
{
  "source": "github",
  "sha": "a1b2c3d4e5f6789",
  "message": "feat: Add shadow chain integration",
  "author": "developer",
  "timestamp": "2024-01-01T12:00:00Z",
  "files_changed": 5
}
EOF
echo ""
echo -e "${GREEN}✓${NC} GitHub commit fetched"
wait_for_user

# Step 3: Simulate encryption
echo -e "${BLUE}📍 Step 3: Encrypting Content${NC}"
echo ""
type_text "Encrypting your data with your unique keys..."
echo ""
echo "🔐 Generating symmetric key: $(openssl rand -hex 16)..."
echo "🔐 Encrypting content with XSalsa20-Poly1305..."
echo "🔐 Encrypting symmetric key with your public key..."
echo ""
echo -e "${GREEN}✓${NC} Content encrypted (only you can decrypt)"
wait_for_user

# Step 4: Simulate IPFS upload
echo -e "${BLUE}📍 Step 4: Storing on IPFS${NC}"
echo ""
type_text "Uploading encrypted content to IPFS..."
echo ""
MOCK_CID="QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
echo "📦 IPFS CID: $MOCK_CID"
echo "📦 Size: 1.2 KB"
echo "📦 Pinned: ✓"
echo ""
echo -e "${GREEN}✓${NC} Content stored on IPFS network"
wait_for_user

# Step 5: Simulate blockchain submission
echo -e "${BLUE}📍 Step 5: Recording on Your Private Blockchain${NC}"
echo ""
type_text "Submitting shadow item to your Substrate chain..."
echo ""
cat << EOF
📝 Transaction Details:
   Pallet: shadowPallet
   Method: submitShadowItem
   CID: ${MOCK_CID:0:16}...
   Source: GitHub
   Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
echo ""
echo "⛓️  Block: #12345"
echo "⛓️  Hash: 0x7f8a9b2c3d4e5f6..."
echo ""
echo -e "${GREEN}✓${NC} Transaction confirmed on-chain"
wait_for_user

# Step 6: Show dashboard
echo -e "${BLUE}📍 Step 6: View in Dashboard${NC}"
echo ""
type_text "Your shadow items are now visible in the dashboard..."
echo ""
cat << 'EOF'
┌─────────────────────────────────────────────────────────┐
│  Shadow Chain Dashboard                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Your Shadow Items (2)                              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🐙 GitHub                                       │  │
│  │ Commit: Add shadow chain integration            │  │
│  │ CID: QmYwAPJzv5CZsnA...                        │  │
│  │ Time: 5 minutes ago                             │  │
│  │ [Decrypt]                                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🐦 Twitter                                      │  │
│  │ Tweet: Just deployed Shadow Chain! 🚀           │  │
│  │ CID: QmXkLmNoPqRsTuV...                        │  │
│  │ Time: 1 hour ago                                │  │
│  │ [Decrypt]                                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
EOF
wait_for_user

# Step 7: Privacy guarantee
echo -e "${BLUE}📍 Step 7: Your Privacy Guaranteed${NC}"
echo ""
type_text "Remember, your data is always:"
echo ""
echo -e "  ${GREEN}🔐${NC} Encrypted with your keys"
echo -e "  ${GREEN}🔑${NC} Only you can decrypt"
echo -e "  ${GREEN}⛓️${NC} Stored on your private blockchain"
echo -e "  ${GREEN}🌐${NC} Distributed via IPFS"
echo -e "  ${GREEN}🛡️${NC} Under your complete control"
echo ""
wait_for_user

# Complete
echo -e "${PURPLE}╔════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║          Demo Complete!                    ║${NC}"
echo -e "${PURPLE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✨ Shadow Chain is ready for you!${NC}"
echo ""
echo "🚀 To start using Shadow Chain:"
echo "   1. Run: make dev"
echo "   2. Open: http://localhost:3000"
echo "   3. Connect your Polkadot.js wallet"
echo "   4. Authorize syncing"
echo ""
echo -e "${CYAN}Your keys • Your data • Your blockchain${NC}"
echo ""