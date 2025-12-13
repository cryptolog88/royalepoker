<div align="center">
<img width="1200" height="475" alt="Royale Poker Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🃏 Royale Poker

**Decentralized Texas Hold'em Poker on Linera Blockchain**

[![Linera](https://img.shields.io/badge/Linera-Testnet%20Conway-blue)](https://linera.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

## 📋 Overview

Royale Poker is a multiplayer Texas Hold'em poker game built on the Linera blockchain. Features real-time gameplay with WebSocket synchronization, deterministic card shuffling, browser-based Linera WASM client for direct blockchain interaction, and persistent chip balances stored on-chain.

## 🔗 Deployment Info

| Network | Value |
|---------|-------|
| **Network** | Testnet Conway |
| **Chain ID** | `208873b668818fc962d8470c68698dc5dff2321720a9bb0d74576d45f4f73c91` |
| **Poker App ID** | `9651a4c1832c2a2bb56d3fa910a72c8aa0e10057db9be37ade9377b545515b94` |
| **Arena App ID** | `fb98fec36a81c8b4f26bc54e65f68485939372c7b2bb4135cdc26339421e37a5` |
| **Owner** | `0x403bc4052a40835697d74411322cec087a55a7fb81a791ed7a590e7cfd5f612a` |

## ✨ Features

- **Multi-room Poker Tables** - 4 rooms with different blinds and buy-ins:
  - Rookie Lounge (10/20 blinds, 1,000 buy-in)
  - Vegas Strip (50/100 blinds, 5,000 buy-in)
  - Macau High Roller (200/400 blinds, 20,000 buy-in)
  - Royale VIP (500/1000 blinds, 50,000 buy-in)
- **Real-time Multiplayer** - WebSocket sync for instant game state updates across browsers
- **Deterministic Card Shuffling** - Seeded RNG ensures fair, verifiable card distribution
- **Proper Texas Hold'em Flow** - PreFlop → Flop → Turn → River → Showdown
- **Winner Display** - Clear winner announcement with pot winnings
- **Sound Effects** - Audio feedback for fold, check, call, raise, and win actions
- **Global Leaderboard** - Stats submitted to Poker Arena for global rankings
- **Browser-based Blockchain Client** - Linera WASM client runs directly in browser
- **Wallet Integration** - Auto wallet creation and chain claiming via faucet
- **Player Chain ID Tracking** - Each player's chain ID displayed in leaderboard
- **DEBUG Logs** - Blockchain transaction logs visible in browser console

## 🏗️ Architecture

### Browser-based Linera Client

```
┌──────────────────────────────────────────────────────────┐
│                     Browser                               │
│  ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  React Frontend │◄──►│  Linera WASM Client         │  │
│  │  (Game UI)      │    │  (@linera/client)           │  │
│  └─────────────────┘    └─────────────────────────────┘  │
│                                    │                      │
└────────────────────────────────────│──────────────────────┘
                                     │ gRPC-web
                                     ▼
                    ┌────────────────────────────────┐
                    │     Linera Validators          │
                    │  (Testnet Conway)              │
                    └────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
           ┌─────────────────┐              ┌─────────────────┐
           │  Poker Contract │              │  Arena Contract │
           │  (Game Logic)   │              │  (Leaderboard)  │
           └─────────────────┘              └─────────────────┘
```

The Linera WASM client runs directly in the browser, communicating with validators via gRPC-web. No local `linera service` required for gameplay!

### Components

| Component | Description |
|-----------|-------------|
| **poker-contract** | Main game logic, handles player actions (fold, call, raise, etc.) |
| **poker-service** | GraphQL API for querying game state and mutations |
| **poker-arena** | Global leaderboard hub with `submitStats` operation |
| **poker-arena-service** | GraphQL API with direct `submitStats` mutation |
| **poker-types** | Shared types between contract and service |
| **poker-arena-types** | Shared types for Arena contract and service |

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Blockchain Client**: @linera/client 0.15.6 (WASM, runs in browser)
- **Blockchain**: Linera SDK 0.15.5 (Rust smart contracts)
- **Real-time**: WebSocket server for multiplayer sync
- **Styling**: Custom poker table UI with animations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust toolchain with `wasm32-unknown-unknown` target (for contract development)

### 1. Run WebSocket Server

```bash
node server.js
```

### 2. Run Frontend

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3021`

**Note:** No `linera service` required! The Linera WASM client in the browser communicates directly with testnet validators.

### Build Smart Contracts

```bash
cargo build --release --target wasm32-unknown-unknown
```

### Deploy to Testnet

```bash
./deploy-testnet-conway.sh
```

## 📁 Project Structure

```
royale-poker/
├── src/
│   ├── AppLinera.tsx           # Main game component
│   ├── components/
│   │   └── Leaderboard.tsx     # Global leaderboard UI
│   ├── contexts/
│   │   └── LineraContext.tsx   # Linera WASM client context
│   └── hooks/
│       ├── usePokerGame.ts     # Game logic, WebSocket & blockchain calls
│       ├── useLeaderboard.ts   # Local leaderboard cache
│       └── useSound.ts         # Sound effects
├── poker-contract/             # Linera poker smart contract
├── poker-service/              # Poker GraphQL service
├── poker-arena/                # Global leaderboard contract
├── poker-arena-service/        # Arena GraphQL service
├── poker-types/                # Shared poker types
├── poker-arena-types/          # Shared arena types
├── server.js                   # WebSocket server (port 3001)
└── vite.config.ts              # Vite configuration
```

## 🎮 Game Flow

1. **Connect Wallet** - Auto-creates Linera wallet in browser and claims chain from faucet
2. **Select Room** - Choose from 4 poker rooms with different stakes
3. **Join Table** - Enter your name and join with room's buy-in chips
4. **Play Poker** - Standard Texas Hold'em rules
   - PreFlop: Receive 2 hole cards, betting round
   - Flop: 3 community cards revealed
   - Turn: 4th community card
   - River: 5th community card
   - Showdown: Best hand wins
5. **Winner Display** - Shows winner with pot amount for 5 seconds
6. **Leaderboard Update** - Stats sent to Arena via blockchain
7. **Continue or Leave** - Deal next hand or return to lobby

## 🔧 Configuration

Environment variables in `.env.local`:

```env
# Linera Network
VITE_LINERA_CHAIN_ID=208873b668818fc962d8470c68698dc5dff2321720a9bb0d74576d45f4f73c91
VITE_LINERA_APP_ID=9651a4c1832c2a2bb56d3fa910a72c8aa0e10057db9be37ade9377b545515b94
VITE_LINERA_OWNER=0x403bc4052a40835697d74411322cec087a55a7fb81a791ed7a590e7cfd5f612a
VITE_LINERA_NETWORK=testnet-conway

# RPC Endpoints
VITE_LINERA_RPC_1=https://linera-testnet.brightlystake.com:443
VITE_LINERA_RPC_2=https://validator-3.testnet-conway.linera.net:443
VITE_LINERA_FAUCET=https://faucet.testnet-conway.linera.net

# WebSocket Server
VITE_WS_URL=wss://evonft.xyz

# Poker Arena (Global Leaderboard)
VITE_ARENA_APP_ID=fb98fec36a81c8b4f26bc54e65f68485939372c7b2bb4135cdc26339421e37a5
VITE_ARENA_CHAIN_ID=208873b668818fc962d8470c68698dc5dff2321720a9bb0d74576d45f4f73c91
```

## 🔄 Blockchain Integration

Player actions are sent to the blockchain using `application.query()`:

```typescript
// Send player action to blockchain
const resp = await application.query(
    JSON.stringify({
        query: `mutation { playerAction(action: "${action}", playerName: "${name}", amount: ${amount}) }`
    })
);
console.log('[Blockchain] Response:', resp);
```

DEBUG logs from the Linera WASM client appear in browser console:
```
DEBUG linera_rpc::grpc::client: sending gRPC request handler="handle_lite_certificate"
DEBUG linera_core::client: execute_operations returning total_execute_operations_ms=1573
```

## 📜 License

MIT License - feel free to use and modify for your own projects.

---

<div align="center">
Built with ❤️ on <a href="https://linera.io">Linera</a>
</div>
