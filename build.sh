#!/bin/bash
set -e

echo "Building Linera Poker Application..."

# Build contract
echo "Building contract..."
cd poker-contract
cargo build --release --target wasm32-unknown-unknown
cd ..

# Build service
echo "Building service..."
cd poker-service
cargo build --release --target wasm32-unknown-unknown
cd ..

echo "Build complete!"
echo "Contract: target/wasm32-unknown-unknown/release/poker_contract.wasm"
echo "Service: target/wasm32-unknown-unknown/release/poker_service.wasm"
