# Royale Poker - Linera Blockchain Setup

## Prerequisites
```bash
# Install Linera SDK
curl --proto '=https' --tlsv1.2 -sSf https://get.linera.io | sh

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Node.js dependencies
npm install
```

## Build Smart Contracts
```bash
npm run linera:build
```

## Deploy to Linera
```bash
# Start local Linera network
linera net up

# Deploy application
npm run linera:deploy
```

## Configure Environment
Copy `.env.local.example` to `.env.local` and fill in:
- `VITE_LINERA_ENDPOINT` - Your Linera node endpoint
- `VITE_APP_ID` - Application ID from deployment
- `VITE_CHAIN_ID` - Chain ID from deployment

## Run Application
```bash
# Development mode with Linera
npm run dev:linera

# Build for production
npm run build:linera
```

## Architecture
- `poker-contract/` - Smart contract (Rust/WASM)
- `poker-service/` - GraphQL service (Rust/WASM)
- `src/linera/` - Web client integration (TypeScript)
- `src/hooks/` - React hooks for Linera
- `src/AppLinera.tsx` - Blockchain-enabled UI
