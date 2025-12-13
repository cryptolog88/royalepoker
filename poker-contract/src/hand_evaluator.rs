use poker_types::{Card, Rank, HandRank};
use std::collections::HashMap;

pub struct HandEvaluator;

impl HandEvaluator {
    pub fn evaluate_best_hand(cards: &[Card]) -> HandRank {
        let combinations = Self::get_combinations(cards, 5);
        let mut best_hand = HandRank::HighCard(vec![Rank::Two]);

        for combo in combinations {
            let hand_rank = Self::evaluate_five_cards(&combo);
            if hand_rank > best_hand {
                best_hand = hand_rank;
            }
        }

        best_hand
    }

    fn evaluate_five_cards(cards: &[Card]) -> HandRank {
        let mut sorted = cards.to_vec();
        sorted.sort_by(|a, b| b.rank.cmp(&a.rank));

        let is_flush = Self::is_flush(&sorted);
        let is_straight = Self::is_straight(&sorted);

        if is_straight && is_flush {
            if sorted[0].rank == Rank::Ace {
                return HandRank::RoyalFlush;
            }
            return HandRank::StraightFlush(sorted[0].rank);
        }

        let rank_counts = Self::count_ranks(&sorted);

        if let Some(&rank) = rank_counts
            .iter()
            .find(|&(_, &count)| count == 4)
            .map(|(rank, _)| rank)
        {
            let kicker = sorted
                .iter()
                .find(|c| c.rank != rank)
                .map(|c| c.rank)
                .unwrap();
            return HandRank::FourOfAKind(rank, kicker);
        }

        let three = rank_counts
            .iter()
            .find(|&(_, &count)| count == 3)
            .map(|(rank, _)| *rank);
        let pair = rank_counts
            .iter()
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

        if let Some(three_rank) = three {
            let kickers: Vec<Rank> = sorted
                .iter()
                .filter(|c| c.rank != three_rank)
                .map(|c| c.rank)
                .take(2)
                .collect();
            return HandRank::ThreeOfAKind(three_rank, kickers);
        }

        let pairs: Vec<Rank> = rank_counts
            .iter()
            .filter(|&(_, &count)| count == 2)
            .map(|(rank, _)| *rank)
            .collect();

        if pairs.len() == 2 {
            let high_pair = pairs[0].max(pairs[1]);
            let low_pair = pairs[0].min(pairs[1]);
            let kicker = sorted
                .iter()
                .find(|c| c.rank != high_pair && c.rank != low_pair)
                .map(|c| c.rank)
                .unwrap();
            return HandRank::TwoPair(high_pair, low_pair, kicker);
        }

        if let Some(&pair_rank) = pairs.first() {
            let kickers: Vec<Rank> = sorted
                .iter()
                .filter(|c| c.rank != pair_rank)
                .map(|c| c.rank)
                .take(3)
                .collect();
            return HandRank::OnePair(pair_rank, kickers);
        }

        let ranks: Vec<Rank> = sorted.iter().map(|c| c.rank).collect();
        HandRank::HighCard(ranks)
    }

    fn is_flush(cards: &[Card]) -> bool {
        let first_suit = cards[0].suit;
        cards.iter().all(|c| c.suit == first_suit)
    }

    fn is_straight(cards: &[Card]) -> bool {
        let ranks: Vec<u8> = cards.iter().map(|c| c.rank as u8).collect();
        
        for i in 0..ranks.len() - 1 {
            if ranks[i] != ranks[i + 1] + 1 {
                if !(i == 0 && ranks[0] == 14 && ranks[1] == 5) {
                    return false;
                }
            }
        }
        true
    }

    fn count_ranks(cards: &[Card]) -> HashMap<Rank, usize> {
        let mut counts = HashMap::new();
        for card in cards {
            *counts.entry(card.rank).or_insert(0) += 1;
        }
        counts
    }

    fn get_combinations(cards: &[Card], k: usize) -> Vec<Vec<Card>> {
        let mut result = Vec::new();
        let mut combination = Vec::new();
        Self::combine(cards, k, 0, &mut combination, &mut result);
        result
    }

    fn combine(
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
            Self::combine(cards, k, i + 1, current, result);
            current.pop();
        }
    }
}
