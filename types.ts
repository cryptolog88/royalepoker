export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // For comparison (2=2, ..., A=14)
  isHidden?: boolean;
}

export type HandRank = 
  | 'High Card' 
  | 'Pair' 
  | 'Two Pair' 
  | 'Three of a Kind' 
  | 'Straight' 
  | 'Flush' 
  | 'Full House' 
  | 'Four of a Kind' 
  | 'Straight Flush' 
  | 'Royal Flush';

export interface Player {
  id: number;
  name: string;
  chips: number;
  hand: Card[];
  isBot: boolean;
  status: 'active' | 'folded' | 'all-in' | 'waiting' | 'eliminated';
  currentBet: number;
  lastAction?: string;
  avatarUrl: string;
}

export type GamePhase = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Pot {
  amount: number;
  winners: number[]; // Player IDs
}

export type Difficulty = 'Rookie' | 'Pro' | 'Elite' | 'Legend';

export interface Room {
  id: string;
  name: string;
  playersCount: number;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  difficulty: Difficulty;
  themeColor: string;
}