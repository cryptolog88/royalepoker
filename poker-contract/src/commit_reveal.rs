use poker_types::Card;

pub struct CommitReveal;

impl CommitReveal {
    /// Create commitment hash for cards (simple XOR-based hash without SIMD)
    pub fn commit_cards(cards: &[Card; 2], salt: &str) -> [u8; 32] {
        let mut hash = [0u8; 32];
        
        // Simple hash without SIMD
        for (i, card) in cards.iter().enumerate() {
            hash[i * 2] = card.rank as u8;
            hash[i * 2 + 1] = card.suit as u8;
        }
        
        // XOR with salt
        for (i, byte) in salt.bytes().enumerate() {
            if i < 28 {
                hash[i + 4] ^= byte;
            }
        }
        
        hash
    }

    /// Verify revealed cards match commitment
    pub fn verify_reveal(
        commitment: &[u8; 32],
        revealed_cards: &[Card; 2],
        salt: &str,
    ) -> bool {
        let computed_hash = Self::commit_cards(revealed_cards, salt);
        commitment == &computed_hash
    }

    /// Generate random salt
    pub fn generate_salt() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        format!("{:x}", timestamp)
    }

    /// Hash deck for commitment (simple XOR-based hash without SIMD)
    pub fn commit_deck(deck: &[Card]) -> [u8; 32] {
        let mut hash = [0u8; 32];
        for (i, card) in deck.iter().enumerate() {
            let idx = i % 32;
            hash[idx] ^= card.rank as u8;
            hash[(idx + 1) % 32] ^= card.suit as u8;
        }
        hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use poker_types::{Rank, Suit};

    #[test]
    fn test_commit_reveal() {
        let cards = [
            Card { rank: Rank::Ace, suit: Suit::Hearts },
            Card { rank: Rank::King, suit: Suit::Spades },
        ];
        let salt = "test_salt_123";

        let commitment = CommitReveal::commit_cards(&cards, salt);
        assert!(CommitReveal::verify_reveal(&commitment, &cards, salt));

        let wrong_cards = [
            Card { rank: Rank::Queen, suit: Suit::Hearts },
            Card { rank: Rank::Jack, suit: Suit::Spades },
        ];
        assert!(!CommitReveal::verify_reveal(&commitment, &wrong_cards, salt));
    }
}
