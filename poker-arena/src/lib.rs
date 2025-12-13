//! Poker Arena - Global Leaderboard Contract
//!
//! This contract manages the global leaderboard for all poker games.
//! It receives stats from game chains and maintains player rankings.

#![cfg_attr(target_arch = "wasm32", no_main)]

pub mod contract;
pub mod service;
pub mod state;

// Re-export types from poker-arena-types
pub use poker_arena_types::{Message, Operation, Parameters, PlayerStats, PokerArenaAbi};
