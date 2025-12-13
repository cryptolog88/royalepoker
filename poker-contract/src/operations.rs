use linera_sdk::linera_base_types::{ApplicationId, ChainId};
use serde::{Deserialize, Serialize};

/// Application parameters - contains Arena (global leaderboard) config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokerParameters {
    /// The chain where Poker Arena (global leaderboard) is deployed
    pub arena_chain_id: ChainId,
    /// The Poker Arena application ID for cross-app calls
    pub arena_app_id: ApplicationId<poker_arena_types::PokerArenaAbi>,
}
