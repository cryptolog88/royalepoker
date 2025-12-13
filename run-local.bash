#!/usr/bin/env bash

set -eu

echo "🎴 Starting Royale Poker on Local Linera Network..."

# Clean up old wallet for fresh start
echo "🧹 Cleaning up old wallet..."
rm -rf ~/.config/linera

# Initialize local network with faucet
eval "$(linera net helper)"
linera_spawn linera net up --with-faucet

export LINERA_FAUCET_URL=http://localhost:8080
echo "📡 Faucet URL: $LINERA_FAUCET_URL"

# Initialize wallet
echo "💼 Initializing wallet..."
linera wallet init --faucet="$LINERA_FAUCET_URL"

# Request a new chain
echo "⛓️  Requesting new chain..."
CHAIN_OWNER=($(linera wallet request-chain --faucet="$LINERA_FAUCET_URL"))
CHAIN="${CHAIN_OWNER[0]}"
OWNER="${CHAIN_OWNER[1]}"

echo "Chain ID: $CHAIN"
echo "Owner: $OWNER"

# Build WASM modules
echo "📦 Building WASM contracts..."
cargo build --release --target wasm32-unknown-unknown

# Publish modules
echo "🚀 Publishing modules..."
MODULE_ID=$(linera publish-module \
    target/wasm32-unknown-unknown/release/poker_contract.wasm \
    target/wasm32-unknown-unknown/release/poker_service.wasm)

echo "Module ID: $MODULE_ID"

# Create application
echo "🎮 Creating poker application..."
APP_ID=$(linera create-application "$MODULE_ID" \
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
ENV_FILE=".env.local"
echo "VITE_LINERA_CHAIN_ID=$CHAIN" > "$ENV_FILE"
echo "VITE_LINERA_APP_ID=$APP_ID" >> "$ENV_FILE"
echo "VITE_LINERA_OWNER=$OWNER" >> "$ENV_FILE"
echo "VITE_LINERA_PORT=9001" >> "$ENV_FILE"
echo "VITE_LINERA_FAUCET=$LINERA_FAUCET_URL" >> "$ENV_FILE"

echo "✅ Configuration saved to $ENV_FILE"

# Start node service
echo "🌐 Starting Linera node service on port 9001..."
linera service --port 9001 &
SERVICE_PID=$!

# Wait for service to start
sleep 3

echo ""
echo "======================================"
echo "✅ Royale Poker is running!"
echo "======================================"
echo "Chain ID: $CHAIN"
echo "Application ID: $APP_ID"
echo "Owner: $OWNER"
echo ""
echo "🔗 GraphQL Endpoint:"
echo "   http://localhost:9001/chains/$CHAIN/applications/$APP_ID"
echo ""
echo "🎴 To start the frontend:"
echo "   npm run dev"
echo ""
echo "Press Ctrl+C to stop the service"
echo "======================================"

# Wait for interrupt
trap "echo 'Stopping service...'; kill $SERVICE_PID 2>/dev/null; exit" INT
wait
