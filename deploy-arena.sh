#!/usr/bin/env bash

set -eu

echo "🏟️ Deploying Poker Arena to Linera Testnet Conway..."

# Set up wallet configuration - using project local wallet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LINERA_WALLET="$SCRIPT_DIR/.linera/wallet.json"
export LINERA_KEYSTORE="$SCRIPT_DIR/.linera/keystore.json"
export LINERA_STORAGE="rocksdb:$SCRIPT_DIR/.linera/wallet.db"

echo "💼 Using project wallet at: $LINERA_WALLET"

# Load environment
source .env.local 2>/dev/null || true

# Build the arena contract and service
echo "📦 Building Poker Arena..."
cargo build --release --target wasm32-unknown-unknown -p poker-arena
cargo build --release --target wasm32-unknown-unknown -p poker-arena-service

# Get the WASM files
ARENA_CONTRACT="target/wasm32-unknown-unknown/release/poker_arena.wasm"
ARENA_SERVICE="target/wasm32-unknown-unknown/release/poker_arena_service.wasm"

if [ ! -f "$ARENA_CONTRACT" ] || [ ! -f "$ARENA_SERVICE" ]; then
    echo "❌ WASM files not found. Build may have failed."
    exit 1
fi

echo "✅ WASM files ready"

# Use existing chain from wallet (same as poker deployment)
ADMIN_CHAIN="9010ebf06f20474aa062730934bf4405bf7dfe700bed6dee88841b6f3b7e351a"
echo "👤 Admin chain: $ADMIN_CHAIN"

# Display wallet info
echo "📋 Wallet info:"
linera wallet show

# Publish modules
echo "📤 Publishing Arena modules..."
MODULE_ID=$(linera publish-module "$ARENA_CONTRACT" "$ARENA_SERVICE")
echo "📋 Module ID: $MODULE_ID"

# Create application with admin chain as parameter
echo "🚀 Creating Arena application..."
ARENA_APP_ID=$(linera create-application "$MODULE_ID" \
    --json-parameters "{\"admin_chain_id\":\"$ADMIN_CHAIN\"}" \
    --json-argument "null")

echo ""
echo "=========================================="
echo "🏟️ POKER ARENA DEPLOYED SUCCESSFULLY!"
echo "=========================================="
echo "Arena App ID: $ARENA_APP_ID"
echo "Arena Chain ID: $ADMIN_CHAIN"
echo "Admin Chain: $ADMIN_CHAIN"
echo ""
echo "Add these to your .env.local:"
echo "VITE_ARENA_APP_ID=$ARENA_APP_ID"
echo "VITE_ARENA_CHAIN_ID=$ADMIN_CHAIN"
echo "=========================================="

# Append to .env.local
echo "" >> .env.local
echo "# Poker Arena (Global Leaderboard)" >> .env.local
echo "VITE_ARENA_APP_ID=$ARENA_APP_ID" >> .env.local
echo "VITE_ARENA_CHAIN_ID=$ADMIN_CHAIN" >> .env.local

echo "✅ Configuration appended to .env.local"
