use linera_sdk::linera_base_types::ChainId;
use poker_types::{Card, CardCommitment, GamePhase, HandRank, PlayerAction};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum Message {
    /// Cross-chain relay to submit stats to Poker Arena (global leaderboard)
    RelayToArena {
        source_chain: ChainId,
        player_name: String,
        chips: u64,
        hands_won: u64,
        hands_played: u64,
        biggest_pot: u64,
    },
    PlayerJoined {
        player: String,
        name: String,
        buy_in: u64,
        position: u8,
    },
    PlayerLeft {
        player: String,
    },
    ActionSubmitted {
        player: String,
        action: PlayerAction,
    },
    CardsCommitted {
        player: String,
        commitment: CardCommitment,
    },
    CardsRevealed {
        player: String,
        cards: [Card; 2],
    },
    HandStarted {
        dealer: String,
        small_blind: String,
        big_blind: String,
        deck_commitment: [u8; 32],
    },
    CardsDealt {
        player: String,
        cards_encrypted: Vec<u8>,
    },
    CommunityCardsRevealed {
        cards: Vec<Card>,
        phase: GamePhase,
    },
    BettingRoundUpdate {
        phase: GamePhase,
        current_player: String,
        current_bet: u64,
        pot: u64,
    },
    PlayerActed {
        player: String,
        action: PlayerAction,
        chips_remaining: u64,
    },
    HandComplete {
        winners: Vec<Winner>,
        pot_distribution: Vec<(String, u64)>,
    },
    TransferChips {
        from: String,
        to: String,
        amount: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Winner {
    pub player: String,
    pub hand_rank: HandRank,
    pub cards: Vec<Card>,
    pub prize: u64,
}
