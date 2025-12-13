# 🎮 Royale Poker - Game Documentation

Dokumentasi lengkap tentang mekanisme permainan dan proses update chips.

## 📖 Daftar Isi

1. [Alur Permainan](#alur-permainan)
2. [Room & Buy-in](#room--buy-in)
3. [Fase Permainan](#fase-permainan)
4. [Aksi Pemain](#aksi-pemain)
5. [Proses Update Chips](#proses-update-chips)
6. [Leaderboard System](#leaderboard-system)
7. [Arsitektur Teknis](#arsitektur-teknis)

---

## 🎯 Alur Permainan

### 1. Koneksi Wallet
```
User membuka aplikasi
    ↓
Auto-create Linera wallet (jika belum ada)
    ↓
Claim chain dari faucet
    ↓
Wallet siap digunakan
```

### 2. Masuk Lobby
```
User melihat 4 room tersedia
    ↓
Pilih room sesuai level
    ↓
Masukkan nama pemain
    ↓
Klik "Join Table"
    ↓
Chips sesuai buy-in room ditambahkan
```

### 3. Bermain
```
Minimal 2 pemain untuk mulai
    ↓
Klik "Start Game"
    ↓
Kartu dibagikan (2 kartu per pemain)
    ↓
Betting rounds (PreFlop → Flop → Turn → River)
    ↓
Showdown atau semua fold
    ↓
Pemenang diumumkan
    ↓
Chips di-update
    ↓
Leaderboard di-update
```

---

## 🏠 Room & Buy-in

| Room | Small Blind | Big Blind | Buy-in | Level |
|------|-------------|-----------|--------|-------|
| **Rookie Lounge** | 10 | 20 | 1,000 | Pemula |
| **Vegas Strip** | 50 | 100 | 5,000 | Pro |
| **Macau High Roller** | 200 | 400 | 20,000 | Elite |
| **Royale VIP** | 500 | 1,000 | 50,000 | Legend |

### Cara Kerja Buy-in

```typescript
// Saat player join table
const handleJoinTable = async () => {
    const buyIn = activeRoom?.minBuyIn || 1000;
    await joinTable(playerName, buyIn);
};

// Di usePokerGame.ts
const newPlayer: PlayerInfo = {
    name: playerName,
    chips: buyIn,  // Chips sesuai room
    status: 'Active',
    currentBet: 0,
    chainId: playerChainId,
};
```

---

## 🃏 Fase Permainan

### 1. Waiting
- Menunggu pemain bergabung
- Minimal 2 pemain untuk mulai

### 2. PreFlop
- Setiap pemain menerima 2 kartu tertutup
- Blind posting berdasarkan posisi relatif terhadap dealer:
  - **Heads-up (2 pemain)**: Dealer = Small Blind, pemain lain = Big Blind
  - **3+ pemain**: Dealer → SB (dealer+1) → BB (dealer+2)
- First-to-act di PreFlop:
  - **Heads-up**: Small Blind (Dealer) bertindak pertama
  - **3+ pemain**: UTG (pemain setelah Big Blind) bertindak pertama

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
- 3 kartu komunitas dibuka
- Betting round baru (currentBet reset ke 0)
- First-to-act: Pemain aktif pertama setelah dealer

### 4. Turn
- 1 kartu komunitas ke-4 dibuka
- Betting round baru
- First-to-act: Pemain aktif pertama setelah dealer

### 5. River
- 1 kartu komunitas ke-5 (terakhir) dibuka
- Betting round terakhir
- First-to-act: Pemain aktif pertama setelah dealer

### 6. Showdown
- Semua kartu dibuka
- Tangan dievaluasi menggunakan hand evaluator lengkap
- Ranking tangan (tertinggi ke terendah):
  1. **Royal Flush** - A-K-Q-J-10 suit sama
  2. **Straight Flush** - 5 kartu berurutan suit sama
  3. **Four of a Kind** - 4 kartu rank sama
  4. **Full House** - Three of a Kind + Pair
  5. **Flush** - 5 kartu suit sama
  6. **Straight** - 5 kartu berurutan (termasuk A-2-3-4-5 wheel)
  7. **Three of a Kind** - 3 kartu rank sama
  8. **Two Pair** - 2 pasang kartu
  9. **One Pair** - 1 pasang kartu
  10. **High Card** - Kartu tertinggi
- Pot diberikan ke pemenang

### 7. Winner
- Menampilkan pemenang selama 5 detik
- Chips pemenang di-update
- Leaderboard di-update

### 8. ReadyForNextHand
- Siap untuk hand berikutnya
- Pemain bisa klik "Deal Next Hand"

---

## 🎬 Aksi Pemain

### Fold
Menyerah dari hand ini. Kehilangan semua taruhan yang sudah dipasang.

```typescript
case 'fold':
    return { ...p, status: 'Folded' };
```

### Check
Tidak bertaruh (hanya bisa jika tidak ada taruhan sebelumnya).

```typescript
case 'check':
    return p;  // Tidak ada perubahan
```

### Call
Menyamakan taruhan pemain sebelumnya.

```typescript
case 'call': {
    // Hitung jumlah yang harus dibayar
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
Menaikkan taruhan.

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
Memasang semua chips yang tersisa.

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

## 💰 Proses Update Chips

### 1. Saat Betting

Setiap aksi betting mengurangi chips pemain dan menambah pot:

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

### 2. Saat Ada Pemenang (Fold)

Jika semua pemain lain fold:

```typescript
// Hanya 1 pemain tersisa
const playersStillIn = updatedPlayers.filter(p => p.status !== 'Folded');
if (playersStillIn.length === 1) {
    const winner = playersStillIn[0];
    const totalPot = currentState.pot + potIncrease;
    
    // Winner mendapat pot
    const finalPlayers = updatedPlayers.map(p => {
        if (p.name === winner.name) {
            return { 
                ...p, 
                chips: p.chips + totalPot,  // Tambah pot ke chips
                currentBet: 0 
            };
        }
        return { ...p, currentBet: 0 };
    });
}
```

### 3. Saat Showdown

Jika sampai showdown, tangan terbaik menang menggunakan hand evaluator lengkap:

```typescript
// Evaluasi tangan semua pemain menggunakan evaluateBestHand
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

// Bandingkan tangan untuk menentukan pemenang
let winners = [playerHands[0]];
for (let i = 1; i < playerHands.length; i++) {
    const comparison = compareHands(playerHands[i].bestHand, winners[0].bestHand);
    if (comparison > 0) {
        winners = [playerHands[i]]; // Pemenang baru
    } else if (comparison === 0) {
        winners.push(playerHands[i]); // Tie
    }
}

// Winner mendapat pot
const winner = winners[0].player;
winner.chips += totalPot;
```

### 4. Broadcast ke Semua Client

Setelah chips di-update, state di-broadcast via WebSocket:

```typescript
const broadcastState = (newState: PokerGameState) => {
    // Update local state
    setGameState(newState);
    
    // Broadcast ke semua client di room
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

Disimpan di `globalLeaderboard` Map dan localStorage:

```typescript
// Update local cache
globalLeaderboard.set(playerName, {
    name: playerName,
    chips: chips,
    chainId: chainId,
    lastUpdated: Date.now()
});

// Persist ke localStorage
localStorage.setItem('poker_leaderboard_v2', JSON.stringify(data));
```

### Blockchain Leaderboard (Arena)

Update dikirim langsung ke Arena via HTTP:

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

### Kapan Leaderboard Di-update?

1. **Saat Join Table** - Initial chips
2. **Saat Menang Hand** - Winner mendapat +1 handsWon
3. **Saat Hand Selesai** - Semua pemain mendapat +1 handsPlayed

```typescript
// Di broadcastState
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

## 🔧 Arsitektur Teknis

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

Kedua contract mengikuti pola DeadKeys dengan file terpisah:

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

1. **WebSocket** - Real-time game state sync antar browser
2. **HTTP Mutations** - Persist ke blockchain
3. **localStorage** - Backup leaderboard offline

### Deterministic Card Shuffling

Kartu di-shuffle menggunakan seeded random untuk memastikan semua client mendapat hasil yang sama:

```typescript
// Generate seed dari game state
const generateHandSeed = (tableId: string, handNumber: number, playerAddresses: string[]): number => {
    const sortedPlayers = [...playerAddresses].sort().join(',');
    const seedString = `${tableId}:${handNumber}:${sortedPlayers}`;
    return hashString(seedString);
};

// Fisher-Yates shuffle dengan seed
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

## 📊 Contoh Skenario

### Skenario 1: Player A Menang via Fold

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

### Skenario 2: Showdown

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

Aplikasi menggunakan hand evaluator lengkap yang diimplementasikan di frontend (`src/hooks/usePokerGame.ts`):

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

Fitur:
- Evaluasi semua kombinasi 5 kartu dari 7 kartu
- Support untuk A-2-3-4-5 wheel straight
- Perbandingan kicker untuk tie-breaker

---

## 🔗 Links

- [README.md](./README.md) - Overview dan quick start
- [linera-poker-implementation.md](./linera-poker-implementation.md) - Dokumentasi implementasi teknis detail
- [Linera Documentation](https://linera.dev) - Dokumentasi Linera

---

**Last Updated**: Desember 2024
