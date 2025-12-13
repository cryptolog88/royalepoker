# 🎮 Royale Poker - Game Documentation

Complete documentation about game mechanics and chips update process.

## 📖 Table of Contents

1. [Game Flow](#game-flow)
2. [Room & Buy-in](#room--buy-in)
3. [Game Phases](#game-phases)
4. [Player Actions](#player-actions)
5. [Chips Update Process](#chips-update-process)
6. [Leaderboard System](#leaderboard-system)
7. [Technical Architecture](#technical-architecture)

---

## 🎯 Game Flow

### 1. Wallet Connection
```
User opens application
    ↓
Auto-create Linera wallet (if not exists)
    ↓
Claim chain from faucet
    ↓
Wallet ready to use
```

### 2. Enter Lobby
```
User sees 4 available rooms
    ↓
Select room based on level
    ↓
Enter player name
    ↓
Click "Join Table"
    ↓
Chips added according to room buy-in
```

### 3. Playing
```
Minimum 2 players to start
    ↓
Click "Start Game"
    ↓
Cards dealt (2 cards per player)
    ↓
Betting rounds (PreFlop → Flop → Turn → River)
    ↓
Showdown or all fold
    ↓
Winner announced
    ↓
Chips updated
    ↓
Leaderboard updated
```

---

## 🏠 Room & Buy-in

| Room | Small Blind | Big Blind | Buy-in | Level |
|------|-------------|-----------|--------|-------|
| **Rookie Lounge** | 10 | 20 | 1,000 | Beginner |
| **Vegas Strip** | 50 | 100 | 5,000 | Pro |
| **Macau High Roller** | 200 | 400 | 20,000 | Elite |
| **Royale VIP** | 500 | 1,000 | 50,000 | Legend |

### How Buy-in Works

```typescript
// When player joins table
const handleJoinTable = async () => {
    const buyIn = activeRoom?.minBuyIn || 1000;
    await joinTable(playerName, buyIn);
};

// In usePokerGame.ts
const newPlayer: PlayerInfo = {
    name: playerName,
    chips: buyIn,  // Chips according to room
    status: 'Active',
    currentBet: 0,
    chainId: playerChainId,
};
```

---

## 🃏 Game Phases

### 1. Waiting
- Waiting for players to join
- Minimum 2 players to start

### 2. PreFlop
- Each player receives 2 hole cards
- Blind posting based on position relative to dealer:
  - **Heads-up (2 players)**: Dealer = Small Blind, other player = Big Blind
  - **3+ players**: Dealer → SB (dealer+1) → BB (dealer+2)
- First-to-act in PreFlop:
  - **Heads-up**: Small Blind (Dealer) acts first
  - **3+ players**: UTG (player after Big Blind) acts first

```typescript
// Posting blinds - relative to dealer position
const numPlayers = currentState.players.length;
const newDealerPosition = (currentState.dealerPosition + 1) % numPlayers;

// Heads-up: Dealer = SB, other = BB
// 3+ players: Dealer, then SB (dealer+1), then BB (dealer+2)
const smallBlindPos = numPlayers === 2 ? newDealerPosition : (newDealerPosition + 1) % numPlayers;
const bigBlindPos = numPlayers === 2 ? (newDealerPosition + 1) % numPlayers : (newDealerPosition + 2) % numPlayers;

// First to act in PreFlop
const firstToAct = numPlayers === 2 ? smallBlindPos : (bigBlindPos + 1) % numPlayers;

players: currentState.players.map((p, idx) => {
    if (idx === smallBlindPos) {
        return { ...p, chips: p.chips - smallBlindAmount, currentBet: smallBlindAmount };
    } else if (idx === bigBlindPos) {
        return { ...p, chips: p.chips - bigBlindAmount, currentBet: bigBlindAmount };
    }
    return { ...p, currentBet: 0 };
}),
```

### 3. Flop
- 3 community cards revealed
- New betting round (currentBet reset to 0)
- First-to-act: First active player after dealer

### 4. Turn
- 4th community card revealed
- New betting round
- First-to-act: First active player after dealer

### 5. River
- 5th (final) community card revealed
- Final betting round
- First-to-act: First active player after dealer

### 6. Showdown
- All cards revealed
- Hands evaluated using complete hand evaluator
- Hand rankings (highest to lowest):
  1. **Royal Flush** - A-K-Q-J-10 same suit
  2. **Straight Flush** - 5 consecutive cards same suit
  3. **Four of a Kind** - 4 cards same rank
  4. **Full House** - Three of a Kind + Pair
  5. **Flush** - 5 cards same suit
  6. **Straight** - 5 consecutive cards (including A-2-3-4-5 wheel)
  7. **Three of a Kind** - 3 cards same rank
  8. **Two Pair** - 2 pairs of cards
  9. **One Pair** - 1 pair of cards
  10. **High Card** - Highest card
- Pot awarded to winner

### 7. Winner
- Winner displayed for 5 seconds
- Winner's chips updated
- Leaderboard updated

### 8. ReadyForNextHand
- Ready for next hand
- Players can click "Deal Next Hand"

---

## 🎬 Player Actions

### Fold
Give up on this hand. Lose all bets already placed.

```typescript
case 'fold':
    return { ...p, status: 'Folded' };
```

### Check
No bet (only possible if no previous bet).

```typescript
case 'check':
    return p;  // No change
```

### Call
Match the previous player's bet.

```typescript
case 'call': {
    // Calculate amount to pay
    const callAmount = Math.min(
        p.chips, 
        Math.max(0, currentState.currentBet - p.currentBet)
    );
    potIncrease = callAmount;
    const newChips = Math.max(0, p.chips - callAmount);
    return {
        ...p,
        chips: newChips,
        currentBet: p.currentBet + callAmount,
        status: newChips === 0 ? 'AllIn' : p.status,
    };
}
```

### Raise
Increase the bet.

```typescript
case 'raise': {
    const callFirst = Math.max(0, currentState.currentBet - p.currentBet);
    const maxRaise = Math.max(0, p.chips - callFirst);
    const actualRaise = Math.min(amount, maxRaise);
    const totalBet = Math.min(p.chips, callFirst + actualRaise);
    potIncrease = totalBet;
    newTableBet = p.currentBet + totalBet;
    const newChips = Math.max(0, p.chips - totalBet);
    return {
        ...p,
        chips: newChips,
        currentBet: p.currentBet + totalBet,
        status: newChips === 0 ? 'AllIn' : p.status,
    };
}
```

### All-In
Bet all remaining chips.

```typescript
case 'allin': {
    const allInAmount = Math.max(0, p.chips);
    potIncrease = allInAmount;
    return {
        ...p,
        chips: 0,
        currentBet: p.currentBet + allInAmount,
        status: 'AllIn',
    };
}
```

---

## 💰 Chips Update Process

### 1. During Betting

Each betting action reduces player chips and adds to pot:

```
Player chips: 1000
Current bet: 0
Table bet: 100

Player calls:
- callAmount = 100 - 0 = 100
- newChips = 1000 - 100 = 900
- pot += 100

Result:
- Player chips: 900
- Player currentBet: 100
- Pot: increased by 100
```

### 2. When Winner by Fold

If all other players fold:

```typescript
// Only 1 player remaining
const playersStillIn = updatedPlayers.filter(p => p.status !== 'Folded');
if (playersStillIn.length === 1) {
    const winner = playersStillIn[0];
    const totalPot = currentState.pot + potIncrease;
    
    // Winner gets pot
    const finalPlayers = updatedPlayers.map(p => {
        if (p.name === winner.name) {
            return { 
                ...p, 
                chips: p.chips + totalPot,  // Add pot to chips
                currentBet: 0 
            };
        }
        return { ...p, currentBet: 0 };
    });
}
```

### 3. At Showdown

If reaching showdown, best hand wins using complete hand evaluator:

```typescript
// Evaluate all players' hands using evaluateBestHand
const playerHands = playersInShowdown.map((player, idx) => {
    const playerIdx = updatedPlayers.findIndex(p => p.name === player.name);
    const holeCards = currentState.dealtCards?.playerCards?.[playerIdx] || [];
    const bestHand = evaluateBestHand(holeCards, communityCards);
    
    return {
        player,
        holeCards,
        bestHand, // { rank: number, highCards: number[] }
    };
});

// Compare hands to determine winner
let winners = [playerHands[0]];
for (let i = 1; i < playerHands.length; i++) {
    const comparison = compareHands(playerHands[i].bestHand, winners[0].bestHand);
    if (comparison > 0) {
        winners = [playerHands[i]]; // New winner
    } else if (comparison === 0) {
        winners.push(playerHands[i]); // Tie
    }
}

// Winner gets pot
const winner = winners[0].player;
winner.chips += totalPot;
```

### 4. Broadcast to All Clients

After chips updated, state is broadcast via WebSocket:

```typescript
const broadcastState = (newState: PokerGameState) => {
    // Update local state
    setGameState(newState);
    
    // Broadcast to all clients in room
    wsRef.current.send(JSON.stringify({
        type: 'UPDATE_STATE',
        roomId: tableId,
        state: newState,
    }));
};
```

---

## 🏆 Leaderboard System

### Local Leaderboard (In-Memory)

Stored in `globalLeaderboard` Map and localStorage:

```typescript
// Update local cache
globalLeaderboard.set(playerName, {
    name: playerName,
    chips: chips,
    chainId: chainId,
    lastUpdated: Date.now()
});

// Persist to localStorage
localStorage.setItem('poker_leaderboard_v2', JSON.stringify(data));
```

### Blockchain Leaderboard (Arena)

Updates sent directly to Arena via HTTP:

```typescript
const updateBlockchainLeaderboard = async (
    playerName: string, 
    chips: number, 
    playerChainId: string,
    handsWon: number,
    handsPlayed: number,
    biggestPot: number
) => {
    // 1. Update local Poker contract
    const localMutation = `mutation { 
        updateLeaderboard(
            playerName: "${playerName}", 
            chips: ${chips}, 
            chainId: "${playerChainId}"
        ) 
    }`;
    await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, localMutation);

    // 2. Update Arena (Global Leaderboard) - DIRECT HTTP
    const arenaMutation = `mutation { 
        submitStats(
            chainId: "${playerChainId}", 
            name: "${playerName}", 
            chips: ${chips}, 
            handsWon: ${handsWon}, 
            handsPlayed: ${handsPlayed}, 
            biggestPot: ${biggestPot}
        ) 
    }`;
    await sendHttpMutation(ARENA_CHAIN_ID, ARENA_APP_ID, arenaMutation);
};
```

### When is Leaderboard Updated?

1. **On Join Table** - Initial chips
2. **On Win Hand** - Winner gets +1 handsWon
3. **On Hand Complete** - All players get +1 handsPlayed

```typescript
// In broadcastState
if (newState.phase === 'Winner' && newState.winner) {
    const winner = newState.players.find(p => p.name === newState.winner?.name);
    if (winner && winner.chips > 0) {
        updateBlockchainLeaderboard(
            winner.name,
            winner.chips,
            winner.chainId,
            1,  // handsWon
            1,  // handsPlayed
            newState.winner.amount  // biggestPot
        );
    }
}

if (newState.phase === 'ReadyForNextHand') {
    newState.players.forEach(p => {
        if (p.chips > 0) {
            updateBlockchainLeaderboard(p.name, p.chips, p.chainId, 0, 1, 0);
        }
    });
}
```

---

## 🔧 Technical Architecture

### Data Flow

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  Browser A  │ ◄───────────────► │  WS Server  │
└─────────────┘                    │  (port 3001)│
       │                           └─────────────┘
       │                                  ▲
       │ HTTP/GraphQL                     │ WebSocket
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│   Linera    │                    │  Browser B  │
│   Service   │                    └─────────────┘
│  (testnet)  │
└─────────────┘
       │
       │ GraphQL Mutations
       ▼
┌─────────────────────────────────────────┐
│              Linera Blockchain          │
│  ┌─────────────┐    ┌─────────────┐    │
│  │   Poker     │    │   Arena     │    │
│  │  Contract   │    │  Contract   │    │
│  │             │    │             │    │
│  │ - lib.rs    │    │ - lib.rs    │    │
│  │ - contract  │    │ - contract  │    │
│  │ - service   │    │ - service   │    │
│  │ - state     │    │ - state     │    │
│  └─────────────┘    └─────────────┘    │
└─────────────────────────────────────────┘
```

### Contract Structure

Both contracts follow the DeadKeys pattern with separate files:

```
poker-contract/src/
├── lib.rs           # Entry point, exports modules
├── contract.rs      # Contract implementation (game logic)
├── service.rs       # GraphQL service (queries & mutations)
├── state.rs         # PokerState definition
├── commit_reveal.rs # Card commitment system
├── hand_evaluator.rs# Hand ranking evaluation
├── messages.rs      # Cross-chain messages
└── operations.rs    # Operation definitions

poker-arena/src/
├── lib.rs           # Entry point, exports modules
├── contract.rs      # Contract implementation
├── service.rs       # GraphQL service
└── state.rs         # ArenaState (global leaderboard)
```

### State Synchronization

1. **WebSocket** - Real-time game state sync between browsers
2. **HTTP Mutations** - Persist to blockchain
3. **localStorage** - Offline leaderboard backup

### Deterministic Card Shuffling

Cards are shuffled using seeded random to ensure all clients get the same result:

```typescript
// Generate seed from game state
const generateHandSeed = (tableId: string, handNumber: number, playerAddresses: string[]): number => {
    const sortedPlayers = [...playerAddresses].sort().join(',');
    const seedString = `${tableId}:${handNumber}:${sortedPlayers}`;
    return hashString(seedString);
};

// Fisher-Yates shuffle with seed
const shuffleDeck = (seed: number): Card[] => {
    const deck = createDeck();
    const rng = new SeededRandom(seed);
    
    for (let i = deck.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
};
```

---

## 📊 Example Scenarios

### Scenario 1: Player A Wins via Fold

```
Initial:
- Player A: 1000 chips
- Player B: 1000 chips
- Pot: 0

PreFlop:
- Player A (SB): posts 10 → chips: 990
- Player B (BB): posts 20 → chips: 980
- Pot: 30

Player A raises 100:
- Player A: chips 990 - 110 = 880, currentBet: 120
- Pot: 140

Player B folds:
- Player B: status = 'Folded'

Result:
- Player A wins pot (140)
- Player A chips: 880 + 140 = 1020
- Player B chips: 980

Leaderboard Update:
- Player A: 1020 chips, handsWon: 1, handsPlayed: 1
- Player B: 980 chips, handsWon: 0, handsPlayed: 1
```

### Scenario 2: Showdown

```
Initial:
- Player A: 1000 chips
- Player B: 1000 chips

After all betting rounds:
- Player A: 500 chips, currentBet: 500
- Player B: 500 chips, currentBet: 500
- Pot: 1000

Showdown:
- Player A: Pair of Kings
- Player B: Two Pair (Jacks and 5s)

Result:
- Player B wins (Two Pair > Pair)
- Player B chips: 500 + 1000 = 1500
- Player A chips: 500

Leaderboard Update:
- Player B: 1500 chips, handsWon: 1
- Player A: 500 chips, handsWon: 0
```

---

## 🎲 Hand Evaluator

The application uses a complete hand evaluator implemented in frontend (`src/hooks/usePokerGame.ts`):

```typescript
// Hand rankings (higher = better)
const HAND_RANKS = {
    HIGH_CARD: 1,
    ONE_PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10,
};

// Evaluate best 5-card hand from 7 cards (2 hole + 5 community)
const evaluateBestHand = (holeCards: Card[], communityCards: Card[]): { rank: number; highCards: number[] }

// Compare two hands, return 1 if hand1 wins, -1 if hand2 wins, 0 if tie
const compareHands = (hand1, hand2): number
```

Features:
- Evaluates all 5-card combinations from 7 cards
- Support for A-2-3-4-5 wheel straight
- Kicker comparison for tie-breaker

---

## 🔗 Links

- [README.md](./README.md) - Overview and quick start
- [linera-poker-implementation.md](./linera-poker-implementation.md) - Detailed technical implementation documentation
- [Linera Documentation](https://linera.dev) - Linera Documentation

---

**Last Updated**: December 2024
