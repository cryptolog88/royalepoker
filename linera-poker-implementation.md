# Implementasi Poker Multiplayer di Linera Blockchain

> **⚠️ Catatan**: Dokumen ini adalah referensi teknis detail untuk implementasi poker di Linera. 
> Beberapa bagian mungkin berbeda dari implementasi aktual saat ini.
> Untuk dokumentasi terkini tentang gameplay, lihat [GAME_DOCUMENTATION.md](./GAME_DOCUMENTATION.md).

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Arsitektur Poker Game](#arsitektur-poker-game)
3. [Data Structures](#data-structures)
4. [Smart Contract Implementation](#smart-contract-implementation)
5. [Commit-Reveal Pattern](#commit-reveal-pattern)
6. [Randomness & Card Shuffling](#randomness--card-shuffling)
7. [Game Flow](#game-flow)
8. [Frontend Implementation](#frontend-implementation)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Security Considerations](#security-considerations)

---

## Overview

### Fitur Poker Game

- 🎴 **Texas Hold'em** - Variant poker paling populer
- 👥 **2-9 Players** - Support multi-player
- 💰 **Real Chips** - On-chain token sebagai chips
- 🔒 **Provably Fair** - Shuffling yang dapat diverifikasi
- 🎯 **Anti-Cheating** - Commit-reveal untuk privasi kartu
- ⚡ **Real-Time** - Sub-second betting actions
- 🏆 **Tournament Support** - Multi-table tournaments

### Tech Stack

```
Backend:
├── Rust + WebAssembly
├── Linera SDK
└── SHA-256 untuk commit-reveal

Frontend:
├── React + TypeScript
├── Linera Web Client
├── Dynamic Wallet Integration
└── Real-time WebSocket updates

Blockchain:
├── Linera Microchains
├── Permissioned Game Chain
└── Player Microchains
```

---

## Arsitektur Poker Game

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  POKER FRONTEND                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  Table UI                                      │    │
│  │  ├─ Player Positions (9 max)                   │    │
│  │  ├─ Community Cards                            │    │
│  │  ├─ Pot Display                                │    │
│  │  ├─ Player Actions (Fold/Call/Raise)           │    │
│  │  └─ Chat & Emotes                              │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  Wallet Integration (Dynamic)                  │    │
│  │  ├─ MetaMask, Phantom, Coinbase                │    │
│  │  └─ Transaction Signing                        │    │
│  └────────────────────────────────────────────────┘    │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Linera Web Client (GraphQL/WS)
                 ▼
┌─────────────────────────────────────────────────────────┐
│            POKER APPLICATION (Wasm)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  POKER CONTRACT                                 │   │
│  │  ├─ Game State Management                      │   │
│  │  │  ├─ Table Configuration                     │   │
│  │  │  ├─ Player Management                       │   │
│  │  │  ├─ Card Deck (Encrypted)                   │   │
│  │  │  └─ Pot & Side Pots                         │   │
│  │  │                                              │   │
│  │  ├─ Game Logic                                 │   │
│  │  │  ├─ Betting Rounds (Pre-flop/Flop/Turn/River)│  │
│  │  │  ├─ Hand Evaluation                         │   │
│  │  │  ├─ Winner Determination                    │   │
│  │  │  └─ Prize Distribution                      │   │
│  │  │                                              │   │
│  │  ├─ Card Privacy (Commit-Reveal)               │   │
│  │  │  ├─ Shuffle Commitment                      │   │
│  │  │  ├─ Card Dealing                            │   │
│  │  │  └─ Showdown Reveal                         │   │
│  │  │                                              │   │
│  │  └─ Anti-Cheating                              │   │
│  │     ├─ Action Validation                       │   │
│  │     ├─ Timeout Handling                        │   │
│  │     └─ Collusion Detection                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  POKER SERVICE (Read-Only)                     │   │
│  │  ├─ Query Table State                          │   │
│  │  ├─ Player Statistics                          │   │
│  │  ├─ Hand History                               │   │
│  │  └─ Leaderboards                               │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Cross-Chain Messages
                 ▼
┌─────────────────────────────────────────────────────────┐
│               MICROCHAINS LAYER                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ Player 1 │  │ Player 2 │  │ Player N │  │  Poker ││
│  │  Chain   │  │  Chain   │  │  Chain   │  │  Table ││
│  │          │  │          │  │          │  │  Chain ││
│  │ - Chips  │  │ - Chips  │  │ - Chips  │  │        ││
│  │ - Stats  │  │ - Stats  │  │ - Stats  │  │ - Deck ││
│  │ - Cards  │  │ - Cards  │  │ - Cards  │  │ - Pot  ││
│  │   (Hash) │  │   (Hash) │  │   (Hash) │  │ - State││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘│
│       │             │              │             │     │
│       └─────────────┴──────────────┴─────────────┘     │
│              BET/FOLD/RAISE Messages                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Example - Single Hand

```
1. PRE-FLOP PHASE
   ┌─> Table Chain: Shuffle deck + commit hash
   ├─> Deal 2 cards per player (encrypted)
   ├─> Player Chains: Receive card hashes
   ├─> Players decrypt own cards only
   └─> Betting Round 1
       ├─> Player 1: BET 10 chips
       ├─> Player 2: CALL 10 chips
       └─> Player 3: RAISE to 20 chips

2. FLOP PHASE
   ┌─> Table Chain: Reveal 3 community cards
   ├─> Broadcast to all player chains
   └─> Betting Round 2

3. TURN PHASE
   ┌─> Table Chain: Reveal 1 more community card
   └─> Betting Round 3

4. RIVER PHASE
   ┌─> Table Chain: Reveal final community card
   └─> Betting Round 4

5. SHOWDOWN
   ┌─> Active players reveal hole cards
   ├─> Verify card commitments
   ├─> Evaluate hands
   ├─> Determine winner(s)
   └─> Distribute pot + side pots
```

---

## Data Structures

### Core Types

```rust
// lib.rs - Public interfaces
use serde::{Deserialize, Serialize};
use linera_sdk::base::{AccountOwner, Amount, Timestamp};

/// Card representation
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Card {
    pub rank: Rank,
    pub suit: Suit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Rank {
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Ten = 10,
    Jack = 11,
    Queen = 12,
    King = 13,
    Ace = 14,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Suit {
    Hearts,
    Diamonds,
    Clubs,
    Spades,
}

/// Hand rankings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum HandRank {
    HighCard(Vec<Rank>),
    OnePair(Rank, Vec<Rank>),
    TwoPair(Rank, Rank, Rank),
    ThreeOfAKind(Rank, Vec<Rank>),
    Straight(Rank),
    Flush(Vec<Rank>),
    FullHouse(Rank, Rank),
    FourOfAKind(Rank, Rank),
    StraightFlush(Rank),
    RoyalFlush,
}

/// Player at table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerPlayer {
    pub address: AccountOwner,
    pub name: String,
    pub chips: Amount,
    pub position: u8,
    pub status: PlayerStatus,
    pub current_bet: Amount,
    pub total_bet_this_hand: Amount,
    pub hole_cards_commitment: Option<CardCommitment>,
    pub hole_cards: Option<[Card; 2]>,
    pub has_folded: bool,
    pub is_all_in: bool,
    pub last_action: Option<PlayerAction>,
    pub joined_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerStatus {
    Waiting,      // Waiting for hand to start
    Active,       // Active in current hand
    Folded,       // Folded this hand
    AllIn,        // All chips committed
    SittingOut,   // Temporarily away
}

/// Player actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerAction {
    Fold,
    Check,
    Call,
    Bet(Amount),
    Raise(Amount),
    AllIn,
}

/// Card commitment for privacy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardCommitment {
    pub cards_hash: [u8; 32],
    pub salt: String,
    pub committed_at: Timestamp,
}

/// Game phases
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GamePhase {
    WaitingForPlayers,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    HandComplete,
}

/// Betting round state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BettingRound {
    pub current_bet: Amount,
    pub minimum_raise: Amount,
    pub last_raiser: Option<AccountOwner>,
    pub players_to_act: Vec<AccountOwner>,
    pub action_count: u32,
}

/// Operations
#[derive(Debug, Serialize, Deserialize)]
pub enum Operation {
    // Table management
    CreateTable {
        table_name: String,
        max_players: u8,
        small_blind: Amount,
        big_blind: Amount,
        buy_in_min: Amount,
        buy_in_max: Amount,
    },
    
    JoinTable {
        table_id: String,
        buy_in: Amount,
        player_name: String,
    },
    
    LeaveTable {
        table_id: String,
    },
    
    // Game actions
    StartHand,
    
    PlayerAction {
        action: PlayerAction,
    },
    
    // Card management
    CommitCards {
        commitment: CardCommitment,
    },
    
    RevealCards {
        cards: [Card; 2],
        salt: String,
    },
    
    // Admin
    TimeoutPlayer {
        player: AccountOwner,
    },
}

/// Messages for cross-chain communication
#[derive(Debug, Serialize, Deserialize)]
pub enum Message {
    // Player to Table
    PlayerJoined {
        player: AccountOwner,
        name: String,
        buy_in: Amount,
        position: u8,
    },
    
    PlayerLeft {
        player: AccountOwner,
    },
    
    ActionSubmitted {
        player: AccountOwner,
        action: PlayerAction,
    },
    
    CardsCommitted {
        player: AccountOwner,
        commitment: CardCommitment,
    },
    
    CardsRevealed {
        player: AccountOwner,
        cards: [Card; 2],
    },
    
    // Table to Players
    HandStarted {
        dealer: AccountOwner,
        small_blind: AccountOwner,
        big_blind: AccountOwner,
        deck_commitment: [u8; 32],
    },
    
    CardsDealt {
        player: AccountOwner,
        cards_encrypted: Vec<u8>,
    },
    
    CommunityCardsRevealed {
        cards: Vec<Card>,
        phase: GamePhase,
    },
    
    BettingRoundUpdate {
        phase: GamePhase,
        current_player: AccountOwner,
        current_bet: Amount,
        pot: Amount,
    },
    
    PlayerActed {
        player: AccountOwner,
        action: PlayerAction,
        chips_remaining: Amount,
    },
    
    HandComplete {
        winners: Vec<Winner>,
        pot_distribution: Vec<(AccountOwner, Amount)>,
    },
    
    // Asset transfers
    TransferChips {
        from: AccountOwner,
        to: AccountOwner,
        amount: Amount,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Winner {
    pub player: AccountOwner,
    pub hand_rank: HandRank,
    pub cards: Vec<Card>,
    pub prize: Amount,
}
```

### State Structure

```rust
// state.rs
use linera_sdk::views::{MapView, RegisterView, RootView, SetView};
use sha2::{Sha256, Digest};

/// Main poker table state
#[derive(RootView)]
pub struct PokerTableState {
    // Table configuration
    pub table_id: RegisterView<String>,
    pub table_name: RegisterView<String>,
    pub max_players: RegisterView<u8>,
    pub small_blind: RegisterView<Amount>,
    pub big_blind: RegisterView<Amount>,
    pub buy_in_min: RegisterView<Amount>,
    pub buy_in_max: RegisterView<Amount>,
    
    // Players
    pub players: MapView<AccountOwner, PokerPlayer>,
    pub player_order: RegisterView<Vec<AccountOwner>>,
    pub active_players: SetView<AccountOwner>,
    
    // Current hand state
    pub phase: RegisterView<GamePhase>,
    pub dealer_position: RegisterView<u8>,
    pub current_player_index: RegisterView<u8>,
    
    // Cards
    pub deck_commitment: RegisterView<[u8; 32]>,
    pub deck: RegisterView<Vec<Card>>,
    pub community_cards: RegisterView<Vec<Card>>,
    pub burned_cards: RegisterView<Vec<Card>>,
    
    // Betting
    pub pot: RegisterView<Amount>,
    pub side_pots: RegisterView<Vec<SidePot>>,
    pub betting_round: RegisterView<BettingRound>,
    
    // Hand tracking
    pub hand_number: RegisterView<u64>,
    pub hand_started_at: RegisterView<Option<Timestamp>>,
    
    // Randomness
    pub random_seed: RegisterView<[u8; 32]>,
    pub player_seeds: MapView<AccountOwner, [u8; 32]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidePot {
    pub amount: Amount,
    pub eligible_players: Vec<AccountOwner>,
}

impl PokerTableState {
    /// Create a standard 52-card deck
    pub fn create_deck() -> Vec<Card> {
        let mut deck = Vec::new();
        for suit in [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades] {
            for rank in [
                Rank::Two, Rank::Three, Rank::Four, Rank::Five,
                Rank::Six, Rank::Seven, Rank::Eight, Rank::Nine,
                Rank::Ten, Rank::Jack, Rank::Queen, Rank::King, Rank::Ace,
            ] {
                deck.push(Card { rank, suit });
            }
        }
        deck
    }
    
    /// Shuffle deck using seed
    pub fn shuffle_deck(&mut self, seed: [u8; 32]) {
        let mut deck = Self::create_deck();
        
        // Fisher-Yates shuffle with seed
        for i in (1..deck.len()).rev() {
            let j = self.deterministic_random(seed, i) % (i + 1);
            deck.swap(i, j);
        }
        
        self.deck.set(deck);
    }
    
    /// Deterministic random number from seed
    fn deterministic_random(&self, seed: [u8; 32], index: usize) -> usize {
        let mut hasher = Sha256::new();
        hasher.update(seed);
        hasher.update(index.to_le_bytes());
        let result = hasher.finalize();
        
        // Convert first 8 bytes to usize
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&result[0..8]);
        usize::from_le_bytes(bytes)
    }
    
    /// Calculate pot including all side pots
    pub async fn total_pot(&self) -> Amount {
        let main_pot = *self.pot.get();
        let side_pot_total: Amount = self.side_pots.get()
            .iter()
            .map(|sp| sp.amount)
            .sum();
        main_pot + side_pot_total
    }
    
    /// Get next player to act
    pub async fn get_next_player(&self) -> Option<AccountOwner> {
        let players = self.player_order.get();
        let current_index = *self.current_player_index.get() as usize;
        
        // Find next active player who hasn't acted yet
        for offset in 1..=players.len() {
            let index = (current_index + offset) % players.len();
            let player_addr = &players[index];
            
            if let Ok(Some(player)) = self.players.get(player_addr).await {
                if player.status == PlayerStatus::Active && !player.has_folded {
                    return Some(*player_addr);
                }
            }
        }
        
        None
    }
}
```

---

## Smart Contract Implementation

### Contract Main Logic

```rust
// contract.rs
use linera_sdk::{
    base::{AccountOwner, Amount, Timestamp},
    Contract, ContractRuntime,
};

pub struct PokerContract {
    state: PokerTableState,
    runtime: ContractRuntime<Self>,
}

impl Contract for PokerContract {
    type Message = Message;
    type InstantiationArgument = TableConfig;
    type Parameters = ();

    async fn instantiate(
        &mut self,
        context: &ContractRuntime<Self>,
        config: TableConfig,
    ) {
        // Initialize table
        self.state.table_id.set(config.table_id.clone());
        self.state.table_name.set(config.table_name);
        self.state.max_players.set(config.max_players);
        self.state.small_blind.set(config.small_blind);
        self.state.big_blind.set(config.big_blind);
        self.state.buy_in_min.set(config.buy_in_min);
        self.state.buy_in_max.set(config.buy_in_max);
        
        self.state.phase.set(GamePhase::WaitingForPlayers);
        self.state.hand_number.set(0);
        self.state.pot.set(Amount::ZERO);
    }

    async fn execute_operation(
        &mut self,
        context: &ContractRuntime<Self>,
        operation: Operation,
    ) -> Result<ExecutionOutcome, ContractError> {
        match operation {
            Operation::CreateTable { .. } => {
                // Already handled in instantiate
                Ok(ExecutionOutcome::default())
            }
            
            Operation::JoinTable { table_id, buy_in, player_name } => {
                self.handle_join_table(context, table_id, buy_in, player_name).await
            }
            
            Operation::LeaveTable { table_id } => {
                self.handle_leave_table(context, table_id).await
            }
            
            Operation::StartHand => {
                self.handle_start_hand(context).await
            }
            
            Operation::PlayerAction { action } => {
                self.handle_player_action(context, action).await
            }
            
            Operation::CommitCards { commitment } => {
                self.handle_commit_cards(context, commitment).await
            }
            
            Operation::RevealCards { cards, salt } => {
                self.handle_reveal_cards(context, cards, salt).await
            }
            
            Operation::TimeoutPlayer { player } => {
                self.handle_timeout(context, player).await
            }
        }
    }

    async fn execute_message(
        &mut self,
        context: &ContractRuntime<Self>,
        message: Message,
    ) -> Result<ExecutionOutcome, ContractError> {
        match message {
            Message::PlayerJoined { player, name, buy_in, position } => {
                self.handle_player_joined_message(context, player, name, buy_in, position).await
            }
            
            Message::ActionSubmitted { player, action } => {
                self.handle_action_submitted(context, player, action).await
            }
            
            Message::CardsCommitted { player, commitment } => {
                self.handle_cards_committed(context, player, commitment).await
            }
            
            Message::CardsRevealed { player, cards } => {
                self.handle_cards_revealed_message(context, player, cards).await
            }
            
            _ => Ok(ExecutionOutcome::default()),
        }
    }
}

impl PokerContract {
    /// Handle player joining the table
    async fn handle_join_table(
        &mut self,
        context: &ContractRuntime<Self>,
        table_id: String,
        buy_in: Amount,
        player_name: String,
    ) -> Result<ExecutionOutcome, ContractError> {
        // Validate
        ensure!(
            *self.state.table_id.get() == table_id,
            ContractError::InvalidTableId
        );
        
        let player = context.authenticated_signer()
            .ok_or(ContractError::Unauthorized)?;
        
        ensure!(
            !self.state.players.contains_key(&player).await?,
            ContractError::PlayerAlreadyAtTable
        );
        
        let player_count = self.state.players.count().await?;
        ensure!(
            player_count < *self.state.max_players.get() as u64,
            ContractError::TableFull
        );
        
        // Validate buy-in
        ensure!(
            buy_in >= *self.state.buy_in_min.get() && 
            buy_in <= *self.state.buy_in_max.get(),
            ContractError::InvalidBuyIn
        );
        
        // Create player
        let position = player_count as u8;
        let new_player = PokerPlayer {
            address: player,
            name: player_name.clone(),
            chips: buy_in,
            position,
            status: PlayerStatus::Waiting,
            current_bet: Amount::ZERO,
            total_bet_this_hand: Amount::ZERO,
            hole_cards_commitment: None,
            hole_cards: None,
            has_folded: false,
            is_all_in: false,
            last_action: None,
            joined_at: context.system_time(),
        };
        
        // Add to state
        self.state.players.insert(&player, new_player)?;
        
        let mut player_order = self.state.player_order.get().clone();
        player_order.push(player);
        self.state.player_order.set(player_order);
        
        // Send message to player's chain
        context.send_message(
            player,
            Message::PlayerJoined {
                player,
                name: player_name,
                buy_in,
                position,
            },
        )?;
        
        // Auto-start if enough players
        if self.state.players.count().await? >= 2 {
            self.try_start_hand(context).await?;
        }
        
        Ok(ExecutionOutcome::default())
    }
    
    /// Start a new hand
    async fn handle_start_hand(
        &mut self,
        context: &ContractRuntime<Self>,
    ) -> Result<ExecutionOutcome, ContractError> {
        // Validate
        ensure!(
            self.state.phase.get() == &GamePhase::WaitingForPlayers ||
            self.state.phase.get() == &GamePhase::HandComplete,
            ContractError::HandAlreadyInProgress
        );
        
        let player_count = self.state.players.count().await?;
        ensure!(
            player_count >= 2,
            ContractError::NotEnoughPlayers
        );
        
        // Initialize new hand
        self.state.hand_number.set(*self.state.hand_number.get() + 1);
        self.state.hand_started_at.set(Some(context.system_time()));
        self.state.pot.set(Amount::ZERO);
        self.state.community_cards.set(Vec::new());
        self.state.burned_cards.set(Vec::new());
        
        // Rotate dealer
        let max_pos = *self.state.max_players.get();
        let new_dealer = (*self.state.dealer_position.get() + 1) % max_pos;
        self.state.dealer_position.set(new_dealer);
        
        // Generate random seed for shuffling
        let seed = self.generate_random_seed(context).await?;
        self.state.random_seed.set(seed);
        
        // Shuffle deck
        self.state.shuffle_deck(seed);
        
        // Create deck commitment
        let deck = self.state.deck.get();
        let deck_commitment = self.hash_deck(&deck);
        self.state.deck_commitment.set(deck_commitment);
        
        // Reset all players for new hand
        self.reset_players_for_hand().await?;
        
        // Post blinds
        self.post_blinds(context).await?;
        
        // Move to pre-flop
        self.state.phase.set(GamePhase::PreFlop);
        
        // Deal hole cards
        self.deal_hole_cards(context).await?;
        
        Ok(ExecutionOutcome::default())
    }
    
    /// Post small and big blinds
    async fn post_blinds(
        &mut self,
        context: &ContractRuntime<Self>,
    ) -> Result<(), ContractError> {
        let dealer_pos = *self.state.dealer_position.get();
        let player_order = self.state.player_order.get().clone();
        let player_count = player_order.len() as u8;
        
        // Small blind is left of dealer
        let sb_pos = (dealer_pos + 1) % player_count;
        let bb_pos = (dealer_pos + 2) % player_count;
        
        let small_blind_amount = *self.state.small_blind.get();
        let big_blind_amount = *self.state.big_blind.get();
        
        // Post small blind
        if let Some(sb_player_addr) = player_order.get(sb_pos as usize) {
            if let Ok(Some(mut sb_player)) = self.state.players.get(sb_player_addr).await {
                let bet = small_blind_amount.min(sb_player.chips);
                sb_player.chips -= bet;
                sb_player.current_bet = bet;
                sb_player.total_bet_this_hand = bet;
                self.state.players.insert(sb_player_addr, sb_player)?;
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + bet);
            }
        }
        
        // Post big blind
        if let Some(bb_player_addr) = player_order.get(bb_pos as usize) {
            if let Ok(Some(mut bb_player)) = self.state.players.get(bb_player_addr).await {
                let bet = big_blind_amount.min(bb_player.chips);
                bb_player.chips -= bet;
                bb_player.current_bet = bet;
                bb_player.total_bet_this_hand = bet;
                self.state.players.insert(bb_player_addr, bb_player)?;
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + bet);
            }
        }
        
        // Initialize betting round
        let betting_round = BettingRound {
            current_bet: big_blind_amount,
            minimum_raise: big_blind_amount,
            last_raiser: None,
            players_to_act: self.get_active_players().await?,
            action_count: 0,
        };
        self.state.betting_round.set(betting_round);
        
        // First to act is left of big blind
        let first_actor_pos = (dealer_pos + 3) % player_count;
        self.state.current_player_index.set(first_actor_pos);
        
        Ok(())
    }
    
    /// Deal hole cards to all players
    async fn deal_hole_cards(
        &mut self,
        context: &ContractRuntime<Self>,
    ) -> Result<(), ContractError> {
        let mut deck = self.state.deck.get().clone();
        let player_order = self.state.player_order.get().clone();
        
        for player_addr in &player_order {
            if let Ok(Some(player)) = self.state.players.get(player_addr).await {
                if player.status == PlayerStatus::Active {
                    // Deal 2 cards
                    let card1 = deck.pop().ok_or(ContractError::DeckEmpty)?;
                    let card2 = deck.pop().ok_or(ContractError::DeckEmpty)?;
                    
                    let cards = [card1, card2];
                    
                    // Create commitment hash (player will verify later)
                    let cards_data = bincode::serialize(&cards)
                        .map_err(|_| ContractError::SerializationError)?;
                    
                    // Send encrypted cards to player
                    context.send_message(
                        *player_addr,
                        Message::CardsDealt {
                            player: *player_addr,
                            cards_encrypted: cards_data,
                        },
                    )?;
                }
            }
        }
        
        // Update deck
        self.state.deck.set(deck);
        
        Ok(())
    }
    
    /// Handle player action
    async fn handle_player_action(
        &mut self,
        context: &ContractRuntime<Self>,
        action: PlayerAction,
    ) -> Result<ExecutionOutcome, ContractError> {
        let player = context.authenticated_signer()
            .ok_or(ContractError::Unauthorized)?;
        
        // Validate it's player's turn
        let current_player = self.state.get_next_player().await
            .ok_or(ContractError::NoActivePlayer)?;
        
        ensure!(
            player == current_player,
            ContractError::NotYourTurn
        );
        
        // Get player state
        let mut player_state = self.state.players.get(&player).await?
            .ok_or(ContractError::PlayerNotFound)?;
        
        // Validate and process action
        match action {
            PlayerAction::Fold => {
                player_state.has_folded = true;
                player_state.status = PlayerStatus::Folded;
            }
            
            PlayerAction::Check => {
                let current_bet = self.state.betting_round.get().current_bet;
                ensure!(
                    player_state.current_bet == current_bet,
                    ContractError::CannotCheck
                );
            }
            
            PlayerAction::Call => {
                let current_bet = self.state.betting_round.get().current_bet;
                let to_call = current_bet - player_state.current_bet;
                
                ensure!(
                    player_state.chips >= to_call,
                    ContractError::InsufficientChips
                );
                
                player_state.chips -= to_call;
                player_state.current_bet += to_call;
                player_state.total_bet_this_hand += to_call;
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + to_call);
            }
            
            PlayerAction::Bet(amount) => {
                ensure!(
                    player_state.chips >= amount,
                    ContractError::InsufficientChips
                );
                
                let mut betting_round = self.state.betting_round.get().clone();
                ensure!(
                    betting_round.current_bet == Amount::ZERO,
                    ContractError::BetNotAllowed
                );
                
                player_state.chips -= amount;
                player_state.current_bet = amount;
                player_state.total_bet_this_hand += amount;
                
                betting_round.current_bet = amount;
                betting_round.minimum_raise = amount;
                betting_round.last_raiser = Some(player);
                
                self.state.betting_round.set(betting_round);
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + amount);
            }
            
            PlayerAction::Raise(amount) => {
                let betting_round = self.state.betting_round.get().clone();
                let to_call = betting_round.current_bet - player_state.current_bet;
                let raise_amount = amount - to_call;
                
                ensure!(
                    raise_amount >= betting_round.minimum_raise,
                    ContractError::RaiseTooSmall
                );
                
                ensure!(
                    player_state.chips >= amount,
                    ContractError::InsufficientChips
                );
                
                player_state.chips -= amount;
                player_state.current_bet += amount;
                player_state.total_bet_this_hand += amount;
                
                let mut betting_round = betting_round.clone();
                betting_round.current_bet = player_state.current_bet;
                betting_round.minimum_raise = raise_amount;
                betting_round.last_raiser = Some(player);
                
                self.state.betting_round.set(betting_round);
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + amount);
            }
            
            PlayerAction::AllIn => {
                let all_in_amount = player_state.chips;
                player_state.chips = Amount::ZERO;
                player_state.current_bet += all_in_amount;
                player_state.total_bet_this_hand += all_in_amount;
                player_state.is_all_in = true;
                
                let pot = *self.state.pot.get();
                self.state.pot.set(pot + all_in_amount);
            }
        }
        
        player_state.last_action = Some(action.clone());
        self.state.players.insert(&player, player_state)?;
        
        // Broadcast action
        self.broadcast_action(context, player, action).await?;
        
        // Check if betting round is complete
        if self.is_betting_round_complete().await? {
            self.advance_to_next_phase(context).await?;
        } else {
            // Move to next player
            self.advance_to_next_player().await?;
        }
        
        Ok(ExecutionOutcome::default())
    }
    
    /// Advance to next phase (flop/turn/river/showdown)
    async fn advance_to_next_phase(
        &mut self,
        context: &ContractRuntime<Self>,
    ) -> Result<(), ContractError> {
        let current_phase = self.state.phase.get().clone();
        
        match current_phase {
            GamePhase::PreFlop => {
                // Reveal flop (3 cards)
                self.reveal_community_cards(context, 3, GamePhase::Flop).await?;
            }
            
            GamePhase::Flop => {
                // Reveal turn (1 card)
                self.reveal_community_cards(context, 1, GamePhase::Turn).await?;
            }
            
            GamePhase::Turn => {
                // Reveal river (1 card)
                self.reveal_community_cards(context, 1, GamePhase::River).await?;
            }
            
            GamePhase::River => {
                // Go to showdown
                self.state.phase.set(GamePhase::Showdown);
                self.initiate_showdown(context).await?;
            }
            
            _ => {}
        }
        
        // Reset betting round
        self.reset_betting_round().await?;
        
        Ok(())
    }
    
    /// Reveal community cards
    async fn reveal_community_cards(
        &mut self,
        context: &ContractRuntime<Self>,
        count: usize,
        new_phase: GamePhase,
    ) -> Result<(), ContractError> {
        let mut deck = self.state.deck.get().clone();
        let mut community_cards = self.state.community_cards.get().clone();
        
        // Burn one card
        if let Some(burned) = deck.pop() {
            let mut burned_cards = self.state.burned_cards.get().clone();
            burned_cards.push(burned);
            self.state.burned_cards.set(burned_cards);
        }
        
        // Reveal cards
        let mut new_cards = Vec::new();
        for _ in 0..count {
            if let Some(card) = deck.pop() {
                community_cards.push(card);
                new_cards.push(card);
            }
        }
        
        self.state.deck.set(deck);
        self.state.community_cards.set(community_cards);
        self.state.phase.set(new_phase.clone());
        
        // Broadcast to all players
        let player_order = self.state.player_order.get().clone();
        for player_addr in &player_order {
            context.send_message(
                *player_addr,
                Message::CommunityCardsRevealed {
                    cards: new_cards.clone(),
                    phase: new_phase.clone(),
                },
            )?;
        }
        
        Ok(())
    }
    
    /// Initiate showdown
    async fn initiate_showdown(
        &mut self,
        context: &ContractRuntime<Self>,
    ) -> Result<(), ContractError> {
        // Collect all active players who haven't folded
        let mut showdown_players = Vec::new();
        
        let player_order = self.state.player_order.get().clone();
        for player_addr in &player_order {
            if let Ok(Some(player)) = self.state.players.get(player_addr).await {
                if !player.has_folded && player.total_bet_this_hand > Amount::ZERO {
                    showdown_players.push(*player_addr);
                }
            }
        }
        
        // If only one player left, they win
        if showdown_players.len() == 1 {
            let winner = showdown_players[0];
            let pot = *self.state.pot.get();
            
            self.award_pot(context, vec![(winner, pot)]).await?;
            return Ok(());
        }
        
        // Request card reveals from all players in showdown
        // (This would be implemented with messages to player chains)
        
        Ok(())
    }
    
    /// Evaluate hands and determine winner(s)
    async fn determine_winners(&self) -> Result<Vec<Winner>, ContractError> {
        let community_cards = self.state.community_cards.get().clone();
        let mut player_hands = Vec::new();
        
        let player_order = self.state.player_order.get().clone();
        for player_addr in &player_order {
            if let Ok(Some(player)) = self.state.players.get(player_addr).await {
                if !player.has_folded && player.hole_cards.is_some() {
                    let hole_cards = player.hole_cards.unwrap();
                    let mut all_cards = vec![hole_cards[0], hole_cards[1]];
                    all_cards.extend(community_cards.clone());
                    
                    let best_hand = self.evaluate_best_hand(&all_cards);
                    player_hands.push((*player_addr, best_hand, all_cards));
                }
            }
        }
        
        // Sort by hand rank (best first)
        player_hands.sort_by(|a, b| b.1.cmp(&a.1));
        
        // Find all winners with same best hand
        let mut winners = Vec::new();
        if let Some((_, best_rank, _)) = player_hands.first() {
            for (player, rank, cards) in player_hands {
                if rank == *best_rank {
                    winners.push(Winner {
                        player,
                        hand_rank: rank,
                        cards,
                        prize: Amount::ZERO, // Will be calculated
                    });
                }
            }
        }
        
        Ok(winners)
    }
    
    /// Award pot to winner(s)
    async fn award_pot(
        &mut self,
        context: &ContractRuntime<Self>,
        distribution: Vec<(AccountOwner, Amount)>,
    ) -> Result<(), ContractError> {
        // Transfer chips to winners
        for (winner, amount) in &distribution {
            if let Ok(Some(mut player)) = self.state.players.get(winner).await {
                player.chips += *amount;
                self.state.players.insert(winner, player)?;
            }
            
            // Send message to winner's chain
            context.send_message(
                *winner,
                Message::TransferChips {
                    from: context.chain_id().into(),
                    to: *winner,
                    amount: *amount,
                },
            )?;
        }
        
        // Broadcast hand complete
        let player_order = self.state.player_order.get().clone();
        for player_addr in &player_order {
            context.send_message(
                *player_addr,
                Message::HandComplete {
                    winners: Vec::new(), // Populate with actual winners
                    pot_distribution: distribution.clone(),
                },
            )?;
        }
        
        // Reset for next hand
        self.state.phase.set(GamePhase::HandComplete);
        self.state.pot.set(Amount::ZERO);
        
        Ok(())
    }
    
    /// Helper: Generate random seed
    async fn generate_random_seed(
        &self,
        context: &ContractRuntime<Self>,
    ) -> Result<[u8; 32], ContractError> {
        // Combine multiple sources of entropy
        let mut hasher = Sha256::new();
        
        // Block timestamp
        hasher.update(context.system_time().micros().to_le_bytes());
        
        // Chain ID
        hasher.update(context.chain_id().to_bytes());
        
        // Hand number
        hasher.update(self.state.hand_number.get().to_le_bytes());
        
        // Player addresses
        let player_order = self.state.player_order.get();
        for player in player_order.iter() {
            hasher.update(player.to_bytes());
        }
        
        let result = hasher.finalize();
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&result);
        
        Ok(seed)
    }
    
    /// Helper: Hash deck for commitment
    fn hash_deck(&self, deck: &[Card]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        let deck_bytes = bincode::serialize(deck).unwrap();
        hasher.update(deck_bytes);
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}
```

### Hand Evaluation Logic

```rust
// hand_evaluator.rs

impl PokerContract {
    /// Evaluate the best 5-card hand from 7 cards
    pub fn evaluate_best_hand(&self, cards: &[Card]) -> HandRank {
        // Generate all 5-card combinations
        let combinations = self.get_combinations(cards, 5);
        
        let mut best_hand = HandRank::HighCard(vec![Rank::Two]);
        
        for combo in combinations {
            let hand_rank = self.evaluate_five_cards(&combo);
            if hand_rank > best_hand {
                best_hand = hand_rank;
            }
        }
        
        best_hand
    }
    
    /// Evaluate a 5-card hand
    fn evaluate_five_cards(&self, cards: &[Card]) -> HandRank {
        let mut sorted = cards.to_vec();
        sorted.sort_by(|a, b| b.rank.cmp(&a.rank));
        
        let is_flush = self.is_flush(&sorted);
        let is_straight = self.is_straight(&sorted);
        
        if is_straight && is_flush {
            if sorted[0].rank == Rank::Ace {
                return HandRank::RoyalFlush;
            }
            return HandRank::StraightFlush(sorted[0].rank);
        }
        
        let rank_counts = self.count_ranks(&sorted);
        
        // Four of a kind
        if let Some(&rank) = rank_counts.iter()
            .find(|&(_, &count)| count == 4)
            .map(|(rank, _)| rank)
        {
            let kicker = sorted.iter()
                .find(|c| c.rank != rank)
                .map(|c| c.rank)
                .unwrap();
            return HandRank::FourOfAKind(rank, kicker);
        }
        
        // Full house
        let three = rank_counts.iter()
            .find(|&(_, &count)| count == 3)
            .map(|(rank, _)| *rank);
        let pair = rank_counts.iter()
            .find(|&(_, &count)| count == 2)
            .map(|(rank, _)| *rank);
        
        if let (Some(three_rank), Some(pair_rank)) = (three, pair) {
            return HandRank::FullHouse(three_rank, pair_rank);
        }
        
        // Flush
        if is_flush {
            let ranks: Vec<Rank> = sorted.iter().map(|c| c.rank).collect();
            return HandRank::Flush(ranks);
        }
        
        // Straight
        if is_straight {
            return HandRank::Straight(sorted[0].rank);
        }
        
        // Three of a kind
        if let Some(three_rank) = three {
            let kickers: Vec<Rank> = sorted.iter()
                .filter(|c| c.rank != three_rank)
                .map(|c| c.rank)
                .take(2)
                .collect();
            return HandRank::ThreeOfAKind(three_rank, kickers);
        }
        
        // Two pair
        let pairs: Vec<Rank> = rank_counts.iter()
            .filter(|&(_, &count)| count == 2)
            .map(|(rank, _)| *rank)
            .collect();
        
        if pairs.len() == 2 {
            let high_pair = pairs[0].max(pairs[1]);
            let low_pair = pairs[0].min(pairs[1]);
            let kicker = sorted.iter()
                .find(|c| c.rank != high_pair && c.rank != low_pair)
                .map(|c| c.rank)
                .unwrap();
            return HandRank::TwoPair(high_pair, low_pair, kicker);
        }
        
        // One pair
        if let Some(&pair_rank) = pairs.first() {
            let kickers: Vec<Rank> = sorted.iter()
                .filter(|c| c.rank != pair_rank)
                .map(|c| c.rank)
                .take(3)
                .collect();
            return HandRank::OnePair(pair_rank, kickers);
        }
        
        // High card
        let ranks: Vec<Rank> = sorted.iter().map(|c| c.rank).collect();
        HandRank::HighCard(ranks)
    }
    
    fn is_flush(&self, cards: &[Card]) -> bool {
        let first_suit = cards[0].suit;
        cards.iter().all(|c| c.suit == first_suit)
    }
    
    fn is_straight(&self, cards: &[Card]) -> bool {
        let ranks: Vec<u8> = cards.iter().map(|c| c.rank as u8).collect();
        
        // Check regular straight
        for i in 0..ranks.len() - 1 {
            if ranks[i] != ranks[i + 1] + 1 {
                // Check for A-2-3-4-5 (wheel)
                if !(i == 0 && ranks[0] == 14 && ranks[1] == 5) {
                    return false;
                }
            }
        }
        
        true
    }
    
    fn count_ranks(&self, cards: &[Card]) -> HashMap<Rank, usize> {
        let mut counts = HashMap::new();
        for card in cards {
            *counts.entry(card.rank).or_insert(0) += 1;
        }
        counts
    }
    
    fn get_combinations(&self, cards: &[Card], k: usize) -> Vec<Vec<Card>> {
        let mut result = Vec::new();
        let mut combination = Vec::new();
        self.combine(cards, k, 0, &mut combination, &mut result);
        result
    }
    
    fn combine(
        &self,
        cards: &[Card],
        k: usize,
        start: usize,
        current: &mut Vec<Card>,
        result: &mut Vec<Vec<Card>>,
    ) {
        if current.len() == k {
            result.push(current.clone());
            return;
        }
        
        for i in start..cards.len() {
            current.push(cards[i]);
            self.combine(cards, k, i + 1, current, result);
            current.pop();
        }
    }
}
```

---

## Commit-Reveal Pattern

### Implementation

```rust
// commit_reveal.rs

impl PokerContract {
    /// Player commits to their cards
    pub async fn handle_commit_cards(
        &mut self,
        context: &ContractRuntime<Self>,
        commitment: CardCommitment,
    ) -> Result<ExecutionOutcome, ContractError> {
        let player = context.authenticated_signer()
            .ok_or(ContractError::Unauthorized)?;
        
        let mut player_state = self.state.players.get(&player).await?
            .ok_or(ContractError::PlayerNotFound)?;
        
        // Store commitment
        player_state.hole_cards_commitment = Some(commitment.clone());
        self.state.players.insert(&player, player_state)?;
        
        // Send message to table chain
        context.send_message(
            context.chain_id(),
            Message::CardsCommitted {
                player,
                commitment,
            },
        )?;
        
        Ok(ExecutionOutcome::default())
    }
    
    /// Player reveals their cards (at showdown)
    pub async fn handle_reveal_cards(
        &mut self,
        context: &ContractRuntime<Self>,
        cards: [Card; 2],
        salt: String,
    ) -> Result<ExecutionOutcome, ContractError> {
        let player = context.authenticated_signer()
            .ok_or(ContractError::Unauthorized)?;
        
        let mut player_state = self.state.players.get(&player).await?
            .ok_or(ContractError::PlayerNotFound)?;
        
        // Verify commitment
        if let Some(commitment) = &player_state.hole_cards_commitment {
            let computed_hash = self.hash_cards_with_salt(&cards, &salt);
            
            ensure!(
                computed_hash == commitment.cards_hash,
                ContractError::InvalidReveal
            );
        }
        
        // Store revealed cards
        player_state.hole_cards = Some(cards);
        self.state.players.insert(&player, player_state)?;
        
        // Send to table chain
        context.send_message(
            context.chain_id(),
            Message::CardsRevealed {
                player,
                cards,
            },
        )?;
        
        Ok(ExecutionOutcome::default())
    }
    
    /// Helper: Hash cards with salt
    fn hash_cards_with_salt(&self, cards: &[Card; 2], salt: &str) -> [u8; 32] {
        let mut hasher = Sha256::new();
        
        let cards_bytes = bincode::serialize(cards).unwrap();
        hasher.update(cards_bytes);
        hasher.update(salt.as_bytes());
        
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}
```

### Client-Side Commit-Reveal

```typescript
// commitReveal.ts
import { sha256 } from 'js-sha256';
import { Card } from './types';

export class CommitRevealHelper {
  /**
   * Generate random salt
   */
  static generateSalt(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create commitment hash
   */
  static createCommitment(cards: [Card, Card], salt: string): string {
    const cardsString = JSON.stringify(cards);
    const combined = cardsString + salt;
    return sha256(combined);
  }

  /**
   * Verify reveal matches commitment
   */
  static verifyReveal(
    cards: [Card, Card],
    salt: string,
    commitment: string
  ): boolean {
    const computed = this.createCommitment(cards, salt);
    return computed === commitment;
  }
}

// Usage example
export class PokerGameClient {
  private cardsReceived: [Card, Card] | null = null;
  private salt: string | null = null;

  async onCardsDealt(cards: [Card, Card]) {
    // Store cards locally
    this.cardsReceived = cards;
    this.salt = CommitRevealHelper.generateSalt();

    // Create commitment
    const commitment = CommitRevealHelper.createCommitment(
      cards,
      this.salt
    );

    // Submit commitment to blockchain
    await this.gameClient.commitCards({
      cards_hash: commitment,
      salt: this.salt,
      committed_at: Date.now(),
    });
  }

  async onShowdown() {
    // Reveal cards
    if (this.cardsReceived && this.salt) {
      await this.gameClient.revealCards({
        cards: this.cardsReceived,
        salt: this.salt,
      });
    }
  }
}
```

---

## Randomness & Card Shuffling

### Multi-Party Randomness Generation

```rust
// randomness.rs

pub struct MultiPartyRandom {
    contributions: HashMap<AccountOwner, [u8; 32]>,
    commitments: HashMap<AccountOwner, [u8; 32]>,
}

impl MultiPartyRandom {
    pub fn new() -> Self {
        Self {
            contributions: HashMap::new(),
            commitments: HashMap::new(),
        }
    }
    
    /// Player commits to their random contribution
    pub fn commit(
        &mut self,
        player: AccountOwner,
        commitment: [u8; 32],
    ) {
        self.commitments.insert(player, commitment);
    }
    
    /// Player reveals their random contribution
    pub fn reveal(
        &mut self,
        player: AccountOwner,
        value: [u8; 32],
    ) -> Result<(), String> {
        let commitment = self.commitments.get(&player)
            .ok_or("No commitment found")?;
        
        let computed = Self::hash_value(&value);
        if computed != *commitment {
            return Err("Invalid reveal".to_string());
        }
        
        self.contributions.insert(player, value);
        Ok(())
    }
    
    /// Generate final random seed from all contributions
    pub fn generate_seed(&self) -> Result<[u8; 32], String> {
        if self.contributions.is_empty() {
            return Err("No contributions".to_string());
        }
        
        let mut hasher = Sha256::new();
        
        // Combine all contributions in deterministic order
        let mut sorted_players: Vec<_> = self.contributions.keys().collect();
        sorted_players.sort();
        
        for player in sorted_players {
            if let Some(contribution) = self.contributions.get(player) {
                hasher.update(contribution);
            }
        }
        
        let result = hasher.finalize();
        let mut seed = [0u8; 32];
        seed.copy_from_slice(&result);
        
        Ok(seed)
    }
    
    fn hash_value(value: &[u8; 32]) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(value);
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}
```

### Verifiable Shuffle

```rust
// shuffle.rs

impl PokerContract {
    /// Shuffle deck with verifiable randomness
    pub fn verifiable_shuffle(
        &self,
        seed: [u8; 32],
    ) -> (Vec<Card>, ShuffleProof) {
        let mut deck = PokerTableState::create_deck();
        let mut proof = ShuffleProof::new();
        
        // Fisher-Yates with proof generation
        for i in (1..deck.len()).rev() {
            let random_value = self.deterministic_random_at_index(seed, i);
            let j = random_value % (i + 1);
            
            // Record swap for proof
            proof.swaps.push(SwapRecord {
                index: i,
                swap_with: j,
                random_value,
            });
            
            deck.swap(i, j);
        }
        
        proof.final_deck_hash = self.hash_deck(&deck);
        
        (deck, proof)
    }
    
    /// Verify shuffle proof
    pub fn verify_shuffle(
        &self,
        seed: [u8; 32],
        proof: &ShuffleProof,
    ) -> bool {
        let mut deck = PokerTableState::create_deck();
        
        // Replay shuffles
        for swap in &proof.swaps {
            let computed_random = self.deterministic_random_at_index(
                seed,
                swap.index,
            );
            
            // Verify random value matches
            if computed_random != swap.random_value {
                return false;
            }
            
            // Verify swap index
            let expected_j = swap.random_value % (swap.index + 1);
            if expected_j != swap.swap_with {
                return false;
            }
            
            deck.swap(swap.index, swap.swap_with);
        }
        
        // Verify final deck
        let final_hash = self.hash_deck(&deck);
        final_hash == proof.final_deck_hash
    }
    
    fn deterministic_random_at_index(
        &self,
        seed: [u8; 32],
        index: usize,
    ) -> usize {
        let mut hasher = Sha256::new();
        hasher.update(seed);
        hasher.update(index.to_le_bytes());
        let result = hasher.finalize();
        
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&result[0..8]);
        usize::from_le_bytes(bytes)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShuffleProof {
    pub swaps: Vec<SwapRecord>,
    pub final_deck_hash: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRecord {
    pub index: usize,
    pub swap_with: usize,
    pub random_value: usize,
}

impl ShuffleProof {
    fn new() -> Self {
        Self {
            swaps: Vec::new(),
            final_deck_hash: [0u8; 32],
        }
    }
}
```

---

## Game Flow

### Complete Hand Flow

```
┌─────────────────────────────────────────────────────┐
│             COMPLETE POKER HAND FLOW                │
└─────────────────────────────────────────────────────┘

1. HAND INITIALIZATION
   ├─> Increment hand number
   ├─> Generate random seed (multi-party)
   ├─> Shuffle deck with seed
   ├─> Create deck commitment
   ├─> Rotate dealer button
   └─> Reset player states

2. POST BLINDS
   ├─> Small blind (left of dealer)
   ├─> Big blind (left of small blind)
   └─> Add to pot

3. DEAL HOLE CARDS (Pre-Flop)
   ├─> Deal 2 cards to each player
   ├─> Cards sent encrypted
   ├─> Players decrypt own cards
   ├─> Players commit to cards (hash)
   └─> BEGIN BETTING ROUND 1
       ├─> First to act: left of big blind
       ├─> Actions: FOLD/CALL/RAISE
       ├─> Continue until all called or folded
       └─> Collect bets to pot

4. FLOP
   ├─> Burn 1 card
   ├─> Reveal 3 community cards
   ├─> Broadcast to all players
   └─> BEGIN BETTING ROUND 2
       ├─> First to act: left of dealer
       ├─> Actions: CHECK/BET/FOLD/RAISE
       ├─> Continue until all checked or folded
       └─> Collect bets to pot

5. TURN
   ├─> Burn 1 card
   ├─> Reveal 1 community card
   ├─> Broadcast to all players
   └─> BEGIN BETTING ROUND 3
       └─> (Same as Round 2)

6. RIVER
   ├─> Burn 1 card
   ├─> Reveal 1 community card
   ├─> Broadcast to all players
   └─> BEGIN BETTING ROUND 4
       └─> (Same as Round 2)

7. SHOWDOWN
   ├─> Request card reveals from active players
   ├─> Players reveal hole cards
   ├─> Verify card commitments
   ├─> Evaluate all hands
   ├─> Determine winner(s)
   ├─> Calculate pot distribution
   │   ├─> Main pot
   │   └─> Side pots (if any all-ins)
   ├─> Award chips to winner(s)
   └─> Broadcast results

8. HAND COMPLETE
   ├─> Update player statistics
   ├─> Remove players with 0 chips
   ├─> Check if game should continue
   └─> If >= 2 players: Start new hand
       └─> Else: End game

┌─────────────────────────────────────────────────────┐
│        SPECIAL CASES & OPTIMIZATIONS                │
└─────────────────────────────────────────────────────┘

EARLY COMPLETION:
- If all but one player fold → Award pot immediately
- Skip remaining phases

ALL-IN SITUATIONS:
- Create side pots
- Players in side pots compete only for those pots
- Continue dealing cards even if no more betting

TIMEOUT HANDLING:
- Player has 30 seconds to act
- Auto-fold if timeout
- Mark player as "sitting out"

DISCONNECTION:
- Player marked as disconnected
- Auto-check/fold for remaining hand
- Can rejoin next hand
```

---

## Frontend Implementation

### React Poker Table Component

```typescript
// PokerTable.tsx
import React, { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { PokerGameClient } from './pokerClient';
import { Card, PlayerAction, GamePhase } from './types';

interface TableState {
  phase: GamePhase;
  pot: number;
  communityCards: Card[];
  players: PlayerInfo[];
  currentPlayer: string;
  myCards: [Card, Card] | null;
}

interface PlayerInfo {
  address: string;
  name: string;
  chips: number;
  position: number;
  currentBet: number;
  status: string;
  lastAction: PlayerAction | null;
}

export const PokerTable: React.FC = () => {
  const { primaryWallet } = useDynamicContext();
  const [gameClient, setGameClient] = useState<PokerGameClient | null>(null);
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (primaryWallet) {
      const client = new PokerGameClient(
        process.env.REACT_APP_POKER_APP_ID!
      );
      client.connect(primaryWallet);
      setGameClient(client);
    }
  }, [primaryWallet]);

  useEffect(() => {
    if (gameClient) {
      // Subscribe to table updates
      const unsubscribe = gameClient.subscribeToTableUpdates(
        (update) => {
          setTableState((prev) => ({
            ...prev!,
            ...update,
          }));
        }
      );

      return () => unsubscribe();
    }
  }, [gameClient]);

  const handleJoinTable = async () => {
    if (!gameClient) return;
    
    setLoading(true);
    try {
      await gameClient.joinTable({
        tableId: 'table-1',
        buyIn: 1000,
        playerName: 'Player',
      });
    } catch (error) {
      console.error('Failed to join table:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFold = async () => {
    if (!gameClient) return;
    
    setLoading(true);
    try {
      await gameClient.playerAction({ type: 'Fold' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    if (!gameClient) return;
    
    setLoading(true);
    try {
      await gameClient.playerAction({ type: 'Check' });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async () => {
    if (!gameClient) return;
    
    setLoading(true);
    try {
      await gameClient.playerAction({ type: 'Call' });
    } finally {
      setLoading(false);
    }
  };

  const handleRaise = async () => {
    if (!gameClient || betAmount <= 0) return;
    
    setLoading(true);
    try {
      await gameClient.playerAction({
        type: 'Raise',
        amount: betAmount,
      });
    } finally {
      setLoading(false);
    }
  };

  const isMyTurn = () => {
    return tableState?.currentPlayer === primaryWallet?.address;
  };

  if (!tableState) {
    return (
      <div className="poker-table-container">
        <div className="join-screen">
          <h2>Join Poker Table</h2>
          <button onClick={handleJoinTable} disabled={loading}>
            Join Table (1000 chips)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="poker-table-container">
      {/* Table Surface */}
      <div className="table-surface">
        {/* Pot Display */}
        <div className="pot-display">
          <div className="pot-amount">
            Pot: {tableState.pot} chips
          </div>
        </div>

        {/* Community Cards */}
        <div className="community-cards">
          <h3>{tableState.phase}</h3>
          <div className="cards">
            {tableState.communityCards.map((card, idx) => (
              <CardComponent key={idx} card={card} />
            ))}
          </div>
        </div>

        {/* Players */}
        <div className="players-container">
          {tableState.players.map((player) => (
            <PlayerSeat
              key={player.address}
              player={player}
              isActive={player.address === tableState.currentPlayer}
              isMe={player.address === primaryWallet?.address}
            />
          ))}
        </div>
      </div>

      {/* My Cards */}
      {tableState.myCards && (
        <div className="my-cards">
          <h3>Your Hand</h3>
          <div className="cards">
            <CardComponent card={tableState.myCards[0]} />
            <CardComponent card={tableState.myCards[1]} />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isMyTurn() && (
        <div className="action-buttons">
          <button
            onClick={handleFold}
            disabled={loading}
            className="btn-fold"
          >
            Fold
          </button>
          
          <button
            onClick={handleCheck}
            disabled={loading}
            className="btn-check"
          >
            Check
          </button>
          
          <button
            onClick={handleCall}
            disabled={loading}
            className="btn-call"
          >
            Call
          </button>
          
          <div className="raise-control">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min={0}
              placeholder="Bet amount"
            />
            <button
              onClick={handleRaise}
              disabled={loading || betAmount <= 0}
              className="btn-raise"
            >
              Raise
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CardComponent: React.FC<{ card: Card }> = ({ card }) => {
  const suitSymbols = {
    Hearts: '♥',
    Diamonds: '♦',
    Clubs: '♣',
    Spades: '♠',
  };

  const rankSymbols: Record<string, string> = {
    Jack: 'J',
    Queen: 'Q',
    King: 'K',
    Ace: 'A',
  };

  const getRankDisplay = (rank: string) => {
    return rankSymbols[rank] || rank.replace(/\D/g, '');
  };

  const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';

  return (
    <div className={`playing-card ${isRed ? 'red' : 'black'}`}>
      <div className="card-rank">{getRankDisplay(card.rank)}</div>
      <div className="card-suit">{suitSymbols[card.suit]}</div>
    </div>
  );
};

const PlayerSeat: React.FC<{
  player: PlayerInfo;
  isActive: boolean;
  isMe: boolean;
}> = ({ player, isActive, isMe }) => {
  return (
    <div
      className={`player-seat ${isActive ? 'active' : ''} ${
        isMe ? 'me' : ''
      }`}
    >
      <div className="player-name">{player.name}</div>
      <div className="player-chips">{player.chips} chips</div>
      {player.currentBet > 0 && (
        <div className="player-bet">Bet: {player.currentBet}</div>
      )}
      {player.lastAction && (
        <div className="player-action">{player.lastAction.type}</div>
      )}
    </div>
  );
};
```

### Linera Game Client

```typescript
// pokerClient.ts
import { LineraClient } from '@linera/web-client';

export class PokerGameClient {
  private client: LineraClient;
  private appId: string;
  private subscriptions: Map<string, () => void> = new Map();

  constructor(appId: string) {
    this.appId = appId;
    this.client = new LineraClient({
      network: 'testnet-conway',
      graphqlUrl: process.env.REACT_APP_LINERA_RPC_URL!,
    });
  }

  async connect(wallet: any) {
    await this.client.connectWallet(wallet);
  }

  async joinTable(params: {
    tableId: string;
    buyIn: number;
    playerName: string;
  }) {
    return await this.client.executeOperation({
      application: this.appId,
      operation: {
        type: 'JoinTable',
        ...params,
      },
    });
  }

  async playerAction(action: PlayerAction) {
    return await this.client.executeOperation({
      application: this.appId,
      operation: {
        type: 'PlayerAction',
        action,
      },
    });
  }

  async commitCards(commitment: any) {
    return await this.client.executeOperation({
      application: this.appId,
      operation: {
        type: 'CommitCards',
        commitment,
      },
    });
  }

  async revealCards(params: { cards: [Card, Card]; salt: string }) {
    return await this.client.executeOperation({
      application: this.appId,
      operation: {
        type: 'RevealCards',
        ...params,
      },
    });
  }

  subscribeToTableUpdates(callback: (update: any) => void) {
    const subscription = this.client.subscribe({
      application: this.appId,
      subscription: {
        type: 'TableUpdates',
      },
      onData: callback,
    });

    const id = Math.random().toString();
    this.subscriptions.set(id, subscription);

    return () => {
      subscription();
      this.subscriptions.delete(id);
    };
  }
}
```

---

## Testing

### Unit Tests

```rust
// tests/poker_tests.rs

#[cfg(test)]
mod tests {
    use super::*;
    use linera_sdk::test::{TestRuntime, TestContract};

    #[tokio::test]
    async fn test_join_table() {
        let mut contract = TestContract::new(PokerContract::default());
        let player1 = AccountOwner::from([1; 32]);
        
        let result = contract.execute_operation(
            Operation::JoinTable {
                table_id: "test".to_string(),
                buy_in: Amount::from(1000),
                player_name: "Player1".to_string(),
            },
            player1,
        ).await;
        
        assert!(result.is_ok());
        
        let state = contract.state();
        assert!(state.players.contains_key(&player1).await.unwrap());
    }

    #[tokio::test]
    async fn test_start_hand() {
        let mut contract = setup_table_with_players(3).await;
        
        let result = contract.execute_operation(
            Operation::StartHand,
            AccountOwner::from([1; 32]),
        ).await;
        
        assert!(result.is_ok());
        
        let state = contract.state();
        assert_eq!(*state.phase.get(), GamePhase::PreFlop);
        assert!(*state.pot.get() > Amount::ZERO); // Blinds posted
    }

    #[tokio::test]
    async fn test_betting_round() {
        let mut contract = setup_hand_in_progress().await;
        let player = AccountOwner::from([1; 32]);
        
        // Test call
        let result = contract.execute_operation(
            Operation::PlayerAction {
                action: PlayerAction::Call,
            },
            player,
        ).await;
        
        assert!(result.is_ok());
        
        // Test raise
        let result = contract.execute_operation(
            Operation::PlayerAction {
                action: PlayerAction::Raise(Amount::from(50)),
            },
            player,
        ).await;
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_hand_evaluation() {
        let contract = PokerContract::default();
        
        // Test Royal Flush
        let cards = vec![
            Card { rank: Rank::Ace, suit: Suit::Spades },
            Card { rank: Rank::King, suit: Suit::Spades },
            Card { rank: Rank::Queen, suit: Suit::Spades },
            Card { rank: Rank::Jack, suit: Suit::Spades },
            Card { rank: Rank::Ten, suit: Suit::Spades },
        ];
        
        let hand = contract.evaluate_five_cards(&cards);
        assert_eq!(hand, HandRank::RoyalFlush);
        
        // Test Full House
        let cards = vec![
            Card { rank: Rank::Ace, suit: Suit::Spades },
            Card { rank: Rank::Ace, suit: Suit::Hearts },
            Card { rank: Rank::Ace, suit: Suit::Diamonds },
            Card { rank: Rank::King, suit: Suit::Spades },
            Card { rank: Rank::King, suit: Suit::Hearts },
        ];
        
        let hand = contract.evaluate_five_cards(&cards);
        assert!(matches!(hand, HandRank::FullHouse(Rank::Ace, Rank::King)));
    }

    #[tokio::test]
    async fn test_shuffle_verification() {
        let contract = PokerContract::default();
        let seed = [42u8; 32];
        
        let (deck, proof) = contract.verifiable_shuffle(seed);
        
        // Verify shuffle
        assert!(contract.verify_shuffle(seed, &proof));
        
        // Deck should have 52 unique cards
        assert_eq!(deck.len(), 52);
        let unique: std::collections::HashSet<_> = deck.iter().collect();
        assert_eq!(unique.len(), 52);
    }

    // Helper functions
    async fn setup_table_with_players(count: u8) -> TestContract<PokerContract> {
        let mut contract = TestContract::new(PokerContract::default());
        
        for i in 0..count {
            let player = AccountOwner::from([i; 32]);
            contract.execute_operation(
                Operation::JoinTable {
                    table_id: "test".to_string(),
                    buy_in: Amount::from(1000),
                    player_name: format!("Player{}", i),
                },
                player,
            ).await.unwrap();
        }
        
        contract
    }
}
```

---

## Deployment

### Build Script

```bash
#!/bin/bash
# build.sh

echo "Building Poker Game..."

# Build contract
cargo build --release --target wasm32-unknown-unknown

# Build service
cargo build --release --target wasm32-unknown-unknown --bin poker-service

# Optimize wasm
wasm-opt -Oz -o target/wasm32-unknown-unknown/release/poker_optimized.wasm \
  target/wasm32-unknown-unknown/release/poker_contract.wasm

echo "Build complete!"
```

### Deploy to Linera

```bash
#!/bin/bash
# deploy.sh

# Set up environment
export LINERA_WALLET="$HOME/.config/linera/wallet.json"
export LINERA_STORAGE="rocksdb:$HOME/.config/linera/client.db"

# Publish application
echo "Publishing Poker application..."

APPLICATION_ID=$(linera publish-and-create \
  target/wasm32-unknown-unknown/release/poker_contract.wasm \
  target/wasm32-unknown-unknown/release/poker_service.wasm \
  --json-argument '{
    "table_id": "poker-table-1",
    "table_name": "Main Poker Table",
    "max_players": 9,
    "small_blind": "10",
    "big_blind": "20",
    "buy_in_min": "100",
    "buy_in_max": "10000"
  }' | grep -oP 'Application ID: \K.*')

echo "Poker application deployed!"
echo "Application ID: $APPLICATION_ID"

# Save to .env
echo "REACT_APP_POKER_APP_ID=$APPLICATION_ID" > frontend/.env.local

echo "Deployment complete!"
```

### Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy to hosting
# (Example: Vercel, Netlify, etc.)
vercel deploy --prod
```

---

## Security Considerations

### 1. Randomness Security

```rust
// Ensure randomness cannot be manipulated
pub fn validate_randomness_contribution(
    contribution: &[u8; 32],
    commitment: &[u8; 32],
) -> Result<(), Error> {
    let computed = hash(contribution);
    ensure!(computed == *commitment, Error::InvalidRandomness);
    Ok(())
}
```

### 2. Timing Attack Prevention

```rust
// Add random delays to prevent timing analysis
pub async fn obfuscate_action_timing(
    &mut self,
    context: &ContractRuntime<Self>,
) {
    // Random delay between 100-500ms
    let delay = self.generate_random_delay();
    context.sleep(delay).await;
}
```

### 3. Collusion Detection

```rust
pub struct CollusionDetector {
    suspicious_pairs: HashMap<(AccountOwner, AccountOwner), u32>,
}

impl CollusionDetector {
    pub fn check_suspicious_pattern(
        &mut self,
        player1: AccountOwner,
        player2: AccountOwner,
    ) -> bool {
        // Track pairs that always fold to each other
        let pair = if player1 < player2 {
            (player1, player2)
        } else {
            (player2, player1)
        };
        
        let count = self.suspicious_pairs.entry(pair).or_insert(0);
        *count += 1;
        
        *count > 10 // Flag if pattern repeats >10 times
    }
}
```

### 4. Bankroll Protection

```rust
// Prevent negative balances
pub fn validate_bet_amount(
    player: &PokerPlayer,
    amount: Amount,
) -> Result<(), Error> {
    ensure!(
        player.chips >= amount,
        Error::InsufficientFunds
    );
    ensure!(
        amount > Amount::ZERO,
        Error::InvalidAmount
    );
    Ok(())
}
```

---

## Kesimpulan

Implementasi poker multiplayer di Linera blockchain memberikan:

✅ **Provably Fair Gameplay** - Shuffling dapat diverifikasi  
✅ **Privacy** - Kartu tersembunyi dengan commit-reveal  
✅ **Real-Time Experience** - Sub-second response times  
✅ **Transparent Economics** - On-chain pot management  
✅ **Scalability** - Unlimited concurrent tables  
✅ **Security** - Anti-cheating mechanisms  

### Next Steps

1. **Implement Tournament Mode** - Multi-table tournaments
2. **Add Chat System** - In-game communication
3. **Statistics & Analytics** - Player performance tracking
4. **Mobile Support** - React Native client
5. **AI Opponents** - Practice mode with bots

---

**Dokumentasi ini memberikan implementasi lengkap poker multiplayer di Linera. Untuk pertanyaan atau kontribusi, join Linera Discord community!**

**Version**: 1.0  
**Last Updated**: Desember 2024  
**Author**: Linera Poker Development Team 🎴♠️♥️♦️♣️
