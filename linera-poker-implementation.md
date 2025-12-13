# Multiplayer Poker Implementation on Linera Blockchain

> **⚠️ Note**: This document is a detailed technical reference for poker implementation on Linera.
> Some sections may differ from the current actual implementation.
> For up-to-date gameplay documentation, see [GAME_DOCUMENTATION.md](./GAME_DOCUMENTATION.md).

## 📋 Table of Contents

1. [Overview](#overview)
2. [Poker Game Architecture](#poker-game-architecture)
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

### Poker Game Features

- 🎴 **Texas Hold'em** - Most popular poker variant
- 👥 **2-9 Players** - Multi-player support
- 💰 **Real Chips** - On-chain token as chips
- 🔒 **Provably Fair** - Verifiable shuffling
- 🎯 **Anti-Cheating** - Commit-reveal for card privacy
- ⚡ **Real-Time** - Sub-second betting actions
- 🏆 **Tournament Support** - Multi-table tournaments

### Tech Stack

```
Backend:
├── Rust + WebAssembly
├── Linera SDK
└── SHA-256 for commit-reveal

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

## Poker Game Architecture

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
│  │  Wallet Integration (Linera Web Client)        │    │
│  │  ├─ Auto-create wallet                         │    │
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
```


### Operations and Messages

```rust
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
            
            _ => Ok(ExecutionOutcome::default()),
        }
    }
}
```


### Player Action Handling

```rust
impl PokerContract {
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
            
            _ => {}
        }
        
        player_state.last_action = Some(action.clone());
        self.state.players.insert(&player, player_state)?;
        
        // Check if betting round is complete
        if self.is_betting_round_complete().await? {
            self.advance_to_next_phase(context).await?;
        } else {
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
                self.reveal_community_cards(context, 3, GamePhase::Flop).await?;
            }
            GamePhase::Flop => {
                self.reveal_community_cards(context, 1, GamePhase::Turn).await?;
            }
            GamePhase::Turn => {
                self.reveal_community_cards(context, 1, GamePhase::River).await?;
            }
            GamePhase::River => {
                self.state.phase.set(GamePhase::Showdown);
                self.initiate_showdown(context).await?;
            }
            _ => {}
        }
        
        self.reset_betting_round().await?;
        Ok(())
    }
}
```


### Hand Evaluation Logic

```rust
// hand_evaluator.rs

impl PokerContract {
    /// Evaluate the best 5-card hand from 7 cards
    pub fn evaluate_best_hand(&self, cards: &[Card]) -> HandRank {
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
        
        if is_flush {
            let ranks: Vec<Rank> = sorted.iter().map(|c| c.rank).collect();
            return HandRank::Flush(ranks);
        }
        
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
        
        player_state.hole_cards_commitment = Some(commitment.clone());
        self.state.players.insert(&player, player_state)?;
        
        context.send_message(
            context.chain_id(),
            Message::CardsCommitted { player, commitment },
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
        
        player_state.hole_cards = Some(cards);
        self.state.players.insert(&player, player_state)?;
        
        context.send_message(
            context.chain_id(),
            Message::CardsRevealed { player, cards },
        )?;
        
        Ok(ExecutionOutcome::default())
    }
    
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
  static generateSalt(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static createCommitment(cards: [Card, Card], salt: string): string {
    const cardsString = JSON.stringify(cards);
    const combined = cardsString + salt;
    return sha256(combined);
  }

  static verifyReveal(
    cards: [Card, Card],
    salt: string,
    commitment: string
  ): boolean {
    const computed = this.createCommitment(cards, salt);
    return computed === commitment;
  }
}
```

---

## Randomness & Card Shuffling

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
        
        for swap in &proof.swaps {
            let computed_random = self.deterministic_random_at_index(seed, swap.index);
            
            if computed_random != swap.random_value {
                return false;
            }
            
            let expected_j = swap.random_value % (swap.index + 1);
            if expected_j != swap.swap_with {
                return false;
            }
            
            deck.swap(swap.index, swap.swap_with);
        }
        
        let final_hash = self.hash_deck(&deck);
        final_hash == proof.final_deck_hash
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
       ├─> First to act: left of big blind (3+ players)
       ├─> First to act: small blind (heads-up)
       ├─> Actions: FOLD/CALL/RAISE
       └─> Continue until all called or folded

4. FLOP
   ├─> Burn 1 card
   ├─> Reveal 3 community cards
   └─> BEGIN BETTING ROUND 2
       ├─> First to act: first active player after dealer
       └─> Actions: CHECK/BET/FOLD/RAISE

5. TURN
   ├─> Burn 1 card
   ├─> Reveal 1 community card
   └─> BEGIN BETTING ROUND 3

6. RIVER
   ├─> Burn 1 card
   ├─> Reveal 1 community card
   └─> BEGIN BETTING ROUND 4

7. SHOWDOWN
   ├─> Request card reveals from active players
   ├─> Verify card commitments
   ├─> Evaluate all hands
   ├─> Determine winner(s)
   └─> Distribute pot + side pots

8. HAND COMPLETE
   ├─> Update player statistics
   ├─> Remove players with 0 chips
   └─> If >= 2 players: Start new hand

┌─────────────────────────────────────────────────────┐
│        SPECIAL CASES & OPTIMIZATIONS                │
└─────────────────────────────────────────────────────┘

EARLY COMPLETION:
- If all but one player fold → Award pot immediately

ALL-IN SITUATIONS:
- Create side pots
- Continue dealing cards even if no more betting

TIMEOUT HANDLING:
- Player has 30 seconds to act
- Auto-fold if timeout
```


---

## Frontend Implementation

### React Poker Table Component

```typescript
// PokerTable.tsx
import React, { useState, useEffect } from 'react';
import { useLinera } from '../contexts/LineraContext';

interface TableState {
  phase: string;
  pot: number;
  communityCards: Card[];
  players: PlayerInfo[];
  currentPlayer: string;
  myCards: [Card, Card] | null;
}

export const PokerTable: React.FC = () => {
  const { application, owner, chainId } = useLinera();
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleFold = async () => {
    if (!application) return;
    setLoading(true);
    try {
      await application.query(JSON.stringify({
        query: `mutation { playerAction(action: "fold", playerName: "${owner}") }`
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async () => {
    if (!application) return;
    setLoading(true);
    try {
      await application.query(JSON.stringify({
        query: `mutation { playerAction(action: "call", playerName: "${owner}") }`
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleRaise = async () => {
    if (!application || betAmount <= 0) return;
    setLoading(true);
    try {
      await application.query(JSON.stringify({
        query: `mutation { playerAction(action: "raise", playerName: "${owner}", amount: ${betAmount}) }`
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="poker-table-container">
      {/* Table Surface */}
      <div className="table-surface">
        <div className="pot-display">
          Pot: {tableState?.pot || 0} chips
        </div>

        {/* Community Cards */}
        <div className="community-cards">
          {tableState?.communityCards.map((card, idx) => (
            <CardComponent key={idx} card={card} />
          ))}
        </div>

        {/* Players */}
        <div className="players-container">
          {tableState?.players.map((player) => (
            <PlayerSeat key={player.address} player={player} />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={handleFold} disabled={loading}>Fold</button>
        <button onClick={handleCall} disabled={loading}>Call</button>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
        />
        <button onClick={handleRaise} disabled={loading || betAmount <= 0}>
          Raise
        </button>
      </div>
    </div>
  );
};
```

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

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
        
        assert!(contract.verify_shuffle(seed, &proof));
        assert_eq!(deck.len(), 52);
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

echo "Build complete!"
```

### Deploy to Linera

```bash
#!/bin/bash
# deploy.sh

export LINERA_WALLET="$HOME/.config/linera/wallet.json"
export LINERA_STORAGE="rocksdb:$HOME/.config/linera/client.db"

echo "Publishing Poker application..."

APPLICATION_ID=$(linera publish-and-create \
  target/wasm32-unknown-unknown/release/poker_contract.wasm \
  target/wasm32-unknown-unknown/release/poker_service.wasm \
  --json-argument '{
    "table_id": "poker-table-1",
    "table_name": "Main Poker Table",
    "max_players": 9,
    "small_blind": "10",
    "big_blind": "20"
  }')

echo "Application ID: $APPLICATION_ID"
```

---

## Security Considerations

### 1. Randomness Security

```rust
pub fn validate_randomness_contribution(
    contribution: &[u8; 32],
    commitment: &[u8; 32],
) -> Result<(), Error> {
    let computed = hash(contribution);
    ensure!(computed == *commitment, Error::InvalidRandomness);
    Ok(())
}
```

### 2. Bankroll Protection

```rust
pub fn validate_bet_amount(
    player: &PokerPlayer,
    amount: Amount,
) -> Result<(), Error> {
    ensure!(player.chips >= amount, Error::InsufficientFunds);
    ensure!(amount > Amount::ZERO, Error::InvalidAmount);
    Ok(())
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

---

## Conclusion

This multiplayer poker implementation on Linera blockchain provides:

✅ **Provably Fair Gameplay** - Verifiable shuffling  
✅ **Privacy** - Hidden cards with commit-reveal  
✅ **Real-Time Experience** - Sub-second response times  
✅ **Transparent Economics** - On-chain pot management  
✅ **Scalability** - Unlimited concurrent tables  
✅ **Security** - Anti-cheating mechanisms  

### Next Steps

1. **Implement Tournament Mode** - Multi-table tournaments
2. **Add Chat System** - In-game communication
3. **Statistics & Analytics** - Player performance tracking
4. **Mobile Support** - React Native client
5. **Practice Mode** - Training mode with bots

---

**This documentation provides a complete multiplayer poker implementation on Linera. For questions or contributions, join the Linera Discord community!**

**Version**: 1.0  
**Last Updated**: December 2024  
**Author**: Linera Poker Development Team 🎴♠️♥️♦️♣️
