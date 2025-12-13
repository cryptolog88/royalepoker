//! Poker Contract - Game Logic
//!
//! This contract manages poker game state including:
//! - Player management (join, leave, actions)
//! - Hand progression (deal, bet, showdown)
//! - Pot management and winner determination

#![cfg_attr(target_arch = "wasm32", no_main)]

pub mod commit_reveal;
pub mod contract;
pub mod hand_evaluator;
pub mod messages;
pub mod operations;
pub mod service;
pub mod state;

pub use commit_reveal::CommitReveal;
pub use hand_evaluator::HandEvaluator;
pub use messages::*;
pub use operations::PokerParameters;

// Re-export types from poker-types
pub use poker_types::{
    Card, CardCommitment, GamePhase, HandRank, LeaderboardData, Operation,
    PlayerAction, PlayerStatus, PokerAbi, PokerPlayer, Rank, Suit, TableConfig,
};
