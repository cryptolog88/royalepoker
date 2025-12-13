#!/usr/bin/env bash

set -eu

echo "🔄 Upgrading Linera to latest version..."

LINERA_DIR="/media/mdlog/mdlog/Project-MDlabs/linera-protocol"

echo "📦 Building Linera service..."
cargo build --release --manifest-path="$LINERA_DIR/Cargo.toml" -p linera-service

echo "📥 Installing Linera CLI..."
cargo install --path "$LINERA_DIR/linera-service" --force

echo "✅ Checking installed version..."
linera --version

echo ""
echo "======================================"
echo "✅ Linera upgraded successfully!"
echo "======================================"
