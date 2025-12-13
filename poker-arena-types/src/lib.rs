//! Poker Arena types - shared between poker-arena contract and poker-arena-service
//! 
//! This crate contains only type definitions, NO state or contract implementation.
//! State is defined in poker-arena/src/state.rs

use async_graphql::{Request, Response};
use linera_sdk::linera_base_types::{ChainId, ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

// ============================================================================
// ABI
// ============================================================================

/// Poker Arena ABI
pub struct PokerArenaAbi;

impl ContractAbi for PokerArenaAbi {
    type Operation = Operation;
    type Response = u64;
}

impl ServiceAbi for PokerArenaAbi {
    type Query = Request;
    type QueryResponse = Response;
}

// ============================================================================
// Types
// ============================================================================

/// Leaderboard entry with player stats
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct PlayerStats {
    pub name: String,
    pub chips: u64,
    pub hands_won: u64,
    pub hands_played: u64,
    pub biggest_pot: u64,
    pub chain_id: String,
    pub last_updated: u64,
}

// ============================================================================
// Operations
// ============================================================================

/// Arena operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Operation {
    /// Submit player stats to leaderboard
    SubmitStats {
        chain_id: ChainId,
        name: String,
        chips: u64,
        hands_won: u64,
        hands_played: u64,
        biggest_pot: u64,
    },
    /// Add authorized game chain (admin only)
    AddGameChain { chain_id: ChainId },
    /// Remove authorized game chain (admin only)
    RemoveGameChain { chain_id: ChainId },
}

// ============================================================================
// Messages
// ============================================================================

/// Cross-chain messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    /// Relay stats from game chain to arena
    RelayStats {
        source_chain: ChainId,
        name: String,
        chips: u64,
        hands_won: u64,
        hands_played: u64,
        biggest_pot: u64,
    },
}

// ============================================================================
// Parameters
// ============================================================================

/// Arena application parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    /// Admin chain ID that can manage authorized chains
    pub admin_chain_id: ChainId,
}
