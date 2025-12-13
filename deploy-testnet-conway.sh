#!/usr/bin/env bash

set -eu

echo "🎴 Deploying Royale Poker to Linera Testnet Conway..."

# Set up wallet configuration - using project local wallet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LINERA_WALLET="$SCRIPT_DIR/.linera/wallet.json"
export LINERA_KEYSTORE="$SCRIPT_DIR/.linera/keystore.json"
export LINERA_STORAGE="rocksdb:$SCRIPT_DIR/.linera/wallet.db"

echo "💼 Using project wallet at: $LINERA_WALLET"

# Use existing chain from wallet
CHAIN="5ae34aa70924bd5f8cb9d86b8c52c2372cd2d926d35e2bc659798fc1d9e54b7c"
OWNER="0xffcd0e087dfc213d97db737d939e0c1d0e60d91bfde3cf6ff9069b59d648deea"

echo "Chain ID: $CHAIN"
echo "Owner: $OWNER"

# Display wallet info
echo "📋 Wallet info:"
linera wallet show

# Build WASM modules
echo "📦 Building WASM contracts..."
cargo build --release --target wasm32-unknown-unknown

# Publish modules
echo "🚀 Publishing modules to testnet..."
MODULE_ID=$(linera publish-module \
    target/wasm32-unknown-unknown/release/poker_contract.wasm \
    target/wasm32-unknown-unknown/release/poker_service.wasm)

echo "Module ID: $MODULE_ID"

# Arena App ID (deployed separately via deploy-arena.sh)
ARENA_APP_ID="deee0d818f7b800ce7dc132482737255b200dc59764a8a446b3e51a9f591bae7"
ARENA_CHAIN_ID="$CHAIN"

# Create application with parameters including Arena integration
echo "🎮 Creating poker application with Arena integration..."
APP_ID=$(linera create-application "$MODULE_ID" \
    --json-parameters "{\"arena_chain_id\":\"$ARENA_CHAIN_ID\",\"arena_app_id\":\"$ARENA_APP_ID\"}" \
    --json-argument '{
        "table_id": "main-table-1",
        "table_name": "Royale Poker Table",
        "max_players": 4,
        "small_blind": 10,
        "big_blind": 20,
        "buy_in_min": 1000,
        "buy_in_max": 10000
    }')

echo "Application ID: $APP_ID"

# Save configuration
ENV_FILE=".env.testnet"
echo "VITE_LINERA_CHAIN_ID=$CHAIN" > "$ENV_FILE"
echo "VITE_LINERA_APP_ID=$APP_ID" >> "$ENV_FILE"
echo "VITE_LINERA_OWNER=$OWNER" >> "$ENV_FILE"
echo "VITE_LINERA_NETWORK=testnet-conway" >> "$ENV_FILE"

echo "✅ Configuration saved to $ENV_FILE"

echo ""
echo "======================================"
echo "✅ Deployment Successful!"
echo "======================================"
echo "Chain ID: $CHAIN"
echo "Application ID: $APP_ID"
echo "Owner: $OWNER"
echo ""
echo "🌐 You can now interact with your application on testnet Conway"
echo "======================================"
