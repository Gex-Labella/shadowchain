# Running Frontend in Mock Mode

The frontend has been configured to run in mock mode without requiring the Substrate node.

## Quick Start

1. **Install dependencies** (if not already done):
```bash
cd frontend
npm install
```

2. **Run the frontend**:
```bash
npm run dev
```

The app will start on http://localhost:3000

## What Works in Mock Mode

- ✅ UI/UX viewing and navigation
- ✅ Wallet connection (with Polkadot.js extension)
- ✅ Mock shadow items display (simulated data)
- ✅ OAuth connections UI (requires backend API)
- ✅ All visual components and layouts

## What's Mocked

- Substrate node connection (returns mock data)
- Shadow items (shows 2 sample items: 1 GitHub, 1 Twitter)
- Consent records (returns mock consent data)
- Transaction submissions (simulated success)

## To Switch Back to Real Mode

Edit `frontend/src/services/polkadot.ts` and change line 8:
```typescript
// Change from:
const MOCK_MODE = true;

// To:
const MOCK_MODE = false;
```

Then ensure the Substrate node is running:
```bash
# In another terminal
cd substrate-node
cargo build --release
./target/release/node-template --dev
```

## Running with Backend API (Optional)

To test OAuth features, you can also run the backend:

```bash
# In another terminal
cd backend
npm install
npm run dev
```

Note: The backend API runs on port 3001 by default.