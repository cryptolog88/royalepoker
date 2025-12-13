//! Poker types - shared between poker-contract and poker-service
//! This crate contains only types and state definitions, NO contract implementation

use async_graphql::{Request, Response};
use linera_sdk::{
    linera_base_types::{ContractAbi, ServiceAbi},
    views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext},
};
use serde::{Deserialize, Serialize};

// ============================================================================
// ABI
// ============================================================================

pub struct PokerAbi;

impl ContractAbi for PokerAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for PokerAbi {
    type Query = Request;
    type QueryResponse = Response;
}

// ============================================================================
// Types
// ============================================================================

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerPlayer {
    pub address: String,
    pub name: String,
    pub chips: u64,
    pub position: u8,
    pub status: PlayerStatus,
    pub current_bet: u64,
    pub total_bet_this_hand: u64,
    pub hole_cards_commitment: Option<CardCommitment>,
    pub hole_cards: Option<[Card; 2]>,
    pub has_folded: bool,
    pub is_all_in: bool,
    pub last_action: Option<PlayerAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerStatus {
    Waiting,
    Active,
    Folded,
    AllIn,
    SittingOut,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerAction {
    Fold,
    Check,
    Call,
    Bet(u64),
    Raise(u64),
    AllIn,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardCommitment {
    pub cards_hash: [u8; 32],
    pub salt: String,
    pub committed_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum GamePhase {
    #[default]
    WaitingForPlayers,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
    HandComplete,
}

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

// ============================================================================
// Operations
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub enum Operation {
    CreateTable {
        table_name: String,
        max_players: u8,
        small_blind: u64,
        big_blind: u64,
        buy_in_min: u64,
        buy_in_max: u64,
    },
    JoinTable {
        table_id: String,
        buy_in: u64,
        player_name: String,
    },
    LeaveTable {
        table_id: String,
        player_name: String,
    },
    StartHand,
    PlayerAction {
        action: PlayerAction,
        player_name: String,
    },
    CommitCards {
        commitment: CardCommitment,
    },
    RevealCards {
        cards: [Card; 2],
        salt: String,
    },
    TimeoutPlayer {
        player: String,
    },
    UpdateLeaderboard {
        player_name: String,
        chips: u64,
        chain_id: String,
    },
    SubmitToArena {
        player_name: String,
        chips: u64,
        hands_won: u64,
        hands_played: u64,
        biggest_pot: u64,
        chain_id: String, // Player's actual chain ID
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TableConfig {
    pub table_id: String,
    pub table_name: String,
    pub max_players: u8,
    pub small_blind: u64,
    pub big_blind: u64,
    pub buy_in_min: u64,
    pub buy_in_max: u64,
}

// ============================================================================
// State
// ============================================================================

/// Leaderboard entry data
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct LeaderboardData {
    pub chips: u64,
    pub chain_id: String,
}

#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct PokerState {
    pub table_id: RegisterView<String>,
    pub table_name: RegisterView<String>,
    pub max_players: RegisterView<u8>,
    pub small_blind: RegisterView<u64>,
    pub big_blind: RegisterView<u64>,
    pub buy_in_min: RegisterView<u64>,
    pub buy_in_max: RegisterView<u64>,
    pub players: MapView<String, PokerPlayer>,
    pub player_order: RegisterView<Vec<String>>,
    pub phase: RegisterView<GamePhase>,
    pub dealer_position: RegisterView<u8>,
    pub current_player_index: RegisterView<u8>,
    pub deck: RegisterView<Vec<Card>>,
    pub community_cards: RegisterView<Vec<Card>>,
    pub pot: RegisterView<u64>,
    pub current_bet: RegisterView<u64>,
    pub hand_number: RegisterView<u64>,
    pub random_seed: RegisterView<[u8; 32]>,
    pub leaderboard: MapView<String, LeaderboardData>,
}

impl PokerState {
    pub async fn initialize(&mut self, config: TableConfig) {
        self.table_id.set(config.table_id);
        self.table_name.set(config.table_name);
        self.max_players.set(config.max_players);
        self.small_blind.set(config.small_blind);
        self.big_blind.set(config.big_blind);
        self.buy_in_min.set(config.buy_in_min);
        self.buy_in_max.set(config.buy_in_max);
        self.phase.set(GamePhase::WaitingForPlayers);
        self.hand_number.set(0);
        self.pot.set(0);
        self.current_bet.set(0);
        self.dealer_position.set(0);
        self.current_player_index.set(0);
    }

    pub fn create_deck() -> Vec<Card> {
        let mut deck = Vec::new();
        for suit in [Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades] {
            for rank in [
                Rank::Two, Rank::Three, Rank::Four, Rank::Five, Rank::Six,
                Rank::Seven, Rank::Eight, Rank::Nine, Rank::Ten, Rank::Jack,
                Rank::Queen, Rank::King, Rank::Ace,
            ] {
                deck.push(Card { rank, suit });
            }
        }
        deck
    }

    pub fn shuffle_deck(seed: [u8; 32]) -> Vec<Card> {
        let mut deck = Self::create_deck();
        for i in (1..deck.len()).rev() {
            let j = Self::deterministic_random(seed, i) % (i + 1);
            deck.swap(i, j);
        }
        deck
    }

    fn deterministic_random(seed: [u8; 32], index: usize) -> usize {
        let mut result = 0usize;
        for i in 0..4 {
            result ^= (seed[i] as usize) << (i * 8);
        }
        result ^= index;
        result
    }
}
