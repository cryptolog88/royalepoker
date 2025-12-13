import { useState, useEffect, useCallback, useRef } from 'react';
import { useLinera } from '../contexts/LineraContext';
import { globalLeaderboard, syncLeaderboardFromState } from './useLeaderboard';

// WebSocket server for real-time multiplayer sync
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// Linera service URL for direct HTTP queries (like DeadKeys pattern)
const SERVICE_URL = import.meta.env.VITE_LINERA_SERVICE_URL || '';
const POKER_CHAIN_ID = import.meta.env.VITE_LINERA_CHAIN_ID;
const POKER_APP_ID = import.meta.env.VITE_LINERA_APP_ID;
const ARENA_CHAIN_ID = import.meta.env.VITE_ARENA_CHAIN_ID;
const ARENA_APP_ID = import.meta.env.VITE_ARENA_APP_ID;

// Local storage key for leaderboard backup (same as useLeaderboard)
// v2: Added proper chainId tracking per player
const LEADERBOARD_STORAGE_KEY = 'poker_leaderboard_v2';

// Helper to query player chips from Arena blockchain
const getPlayerChipsFromArena = async (playerName: string): Promise<number | null> => {
    if (!SERVICE_URL || !ARENA_CHAIN_ID || !ARENA_APP_ID) {
        console.log('[Arena] Missing config, skipping blockchain query');
        return null;
    }

    try {
        const url = `${SERVICE_URL}/chains/${ARENA_CHAIN_ID}/applications/${ARENA_APP_ID}`;
        console.log('[Arena] Querying player chips from:', url, 'for player:', playerName);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `query { player(name: "${playerName}") { chips } }`
            }),
        });

        if (!response.ok) {
            console.warn('[Arena] HTTP error:', response.status);
            return null;
        }

        const result = await response.json();
        console.log('[Arena] Query result:', result);

        if (result?.data?.player?.chips) {
            const chips = parseInt(result.data.player.chips, 10);
            console.log('[Arena] Found player chips:', chips);
            return chips > 0 ? chips : null;
        }

        console.log('[Arena] Player not found in Arena');
        return null;
    } catch (err) {
        console.error('[Arena] Failed to query player chips:', err);
        return null;
    }
};

// Helper to get player chips from localStorage
const getPlayerChipsFromLocalStorage = (playerName: string): number | null => {
    try {
        const data = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed[playerName]?.chips) {
                const chips = parsed[playerName].chips;
                console.log('[LocalStorage] Found player chips:', chips);
                return chips > 0 ? chips : null;
            }
        }
    } catch (e) {
        console.error('[LocalStorage] Failed to read chips:', e);
    }
    return null;
};

// Helper to update local leaderboard cache AND localStorage
const updateLocalLeaderboard = (players: { address: string; name: string; chips: number; chainId?: string }[]) => {
    console.log('[Leaderboard] updateLocalLeaderboard called with', players.length, 'players');

    let updated = false;
    players.forEach(p => {
        console.log('[Leaderboard] Processing player:', p.name, 'chips:', p.chips, 'chainId:', p.chainId);
        // Always update with current chips (not just highest)
        // Use chainId field if available, otherwise fall back to address
        globalLeaderboard.set(p.name, {
            name: p.name,
            chips: p.chips,
            chainId: p.chainId || p.address || '',
            lastUpdated: Date.now()
        });
        updated = true;
        console.log('[Leaderboard] Updated globalLeaderboard for', p.name, ':', p.chips);
    });

    // Always save to localStorage (even if not "updated" - ensures persistence)
    try {
        const data: Record<string, { chips: number; chainId: string }> = {};
        globalLeaderboard.forEach((value, key) => {
            data[key] = { chips: value.chips, chainId: value.chainId };
        });
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(data));
        console.log('[Leaderboard] Saved to localStorage:', Object.keys(data).length, 'entries', data);
    } catch (e) {
        console.error('[Leaderboard] Failed to save to localStorage:', e);
    }
};

// ============ RANDOMNESS & CARD SHUFFLING ============

// Simple hash function for seed generation
const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// Deterministic random number generator (Linear Congruential Generator)
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    // Returns a number between 0 and 1
    next(): number {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    // Returns an integer between 0 and max-1
    nextInt(max: number): number {
        return Math.floor(this.next() * max);
    }
}

// Create a full deck of 52 cards
const createDeck = (): Card[] => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];

    for (const suit of suits) {
        for (let i = 0; i < ranks.length; i++) {
            deck.push({
                rank: ranks[i],
                suit: suit,
                value: i + 2, // 2-14 (Ace high)
            });
        }
    }
    return deck;
};

// Fisher-Yates shuffle with seed
const shuffleDeck = (seed: number): Card[] => {
    const deck = createDeck();
    const rng = new SeededRandom(seed);

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
};

// Generate seed from game state (deterministic across all clients)
const generateHandSeed = (tableId: string, handNumber: number, playerAddresses: string[]): number => {
    // Combine table ID, hand number, and sorted player addresses
    const sortedPlayers = [...playerAddresses].sort().join(',');
    const seedString = `${tableId}:${handNumber}:${sortedPlayers}`;
    return hashString(seedString);
};

// Deal cards from shuffled deck
const dealCards = (deck: Card[], playerCount: number): { playerCards: Card[][], communityCards: Card[] } => {
    let cardIndex = 0;

    // Deal 2 cards to each player
    const playerCards: Card[][] = [];
    for (let p = 0; p < playerCount; p++) {
        playerCards.push([deck[cardIndex++], deck[cardIndex++]]);
    }

    // Burn one card, then deal flop (3 cards)
    cardIndex++; // burn
    const flop = [deck[cardIndex++], deck[cardIndex++], deck[cardIndex++]];

    // Burn one card, then deal turn (1 card)
    cardIndex++; // burn
    const turn = deck[cardIndex++];

    // Burn one card, then deal river (1 card)
    cardIndex++; // burn
    const river = deck[cardIndex++];

    return {
        playerCards,
        communityCards: [...flop, turn, river],
    };
};

// ============ HAND EVALUATION ============

// Hand rankings (higher = better)
const HAND_RANKS = {
    HIGH_CARD: 1,
    ONE_PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10,
};

// Convert hand rank number to readable name
const getHandRankName = (rank: number): string => {
    const names: Record<number, string> = {
        1: 'High Card',
        2: 'One Pair',
        3: 'Two Pair',
        4: 'Three of a Kind',
        5: 'Straight',
        6: 'Flush',
        7: 'Full House',
        8: 'Four of a Kind',
        9: 'Straight Flush',
        10: 'Royal Flush',
    };
    return names[rank] || 'Unknown';
};

// Get card value (2-14, Ace high)
const getCardValue = (rank: string): number => {
    const values: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || 0;
};

// Evaluate a 5-card hand and return { rank, highCards }
const evaluate5Cards = (cards: Card[]): { rank: number; highCards: number[] } => {
    const values = cards.map(c => getCardValue(c.rank)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    // Check flush
    const isFlush = suits.every(s => s === suits[0]);

    // Check straight (including A-2-3-4-5 wheel)
    const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
    let isStraight = false;
    let straightHigh = 0;

    if (uniqueValues.length === 5) {
        if (uniqueValues[0] - uniqueValues[4] === 4) {
            isStraight = true;
            straightHigh = uniqueValues[0];
        }
        // Check wheel (A-2-3-4-5)
        if (uniqueValues[0] === 14 && uniqueValues[1] === 5 && uniqueValues[4] === 2) {
            isStraight = true;
            straightHigh = 5; // 5-high straight
        }
    }

    // Count occurrences
    const counts: Record<number, number> = {};
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const countValues = Object.entries(counts).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]));

    // Determine hand rank
    if (isStraight && isFlush) {
        if (straightHigh === 14) return { rank: HAND_RANKS.ROYAL_FLUSH, highCards: [14] };
        return { rank: HAND_RANKS.STRAIGHT_FLUSH, highCards: [straightHigh] };
    }

    if (countValues[0][1] === 4) {
        return { rank: HAND_RANKS.FOUR_OF_A_KIND, highCards: [Number(countValues[0][0]), Number(countValues[1][0])] };
    }

    if (countValues[0][1] === 3 && countValues[1][1] === 2) {
        return { rank: HAND_RANKS.FULL_HOUSE, highCards: [Number(countValues[0][0]), Number(countValues[1][0])] };
    }

    if (isFlush) {
        return { rank: HAND_RANKS.FLUSH, highCards: values };
    }

    if (isStraight) {
        return { rank: HAND_RANKS.STRAIGHT, highCards: [straightHigh] };
    }

    if (countValues[0][1] === 3) {
        return { rank: HAND_RANKS.THREE_OF_A_KIND, highCards: [Number(countValues[0][0]), ...values.filter(v => v !== Number(countValues[0][0]))] };
    }

    if (countValues[0][1] === 2 && countValues[1][1] === 2) {
        const pairs = [Number(countValues[0][0]), Number(countValues[1][0])].sort((a, b) => b - a);
        const kicker = values.find(v => v !== pairs[0] && v !== pairs[1]) || 0;
        return { rank: HAND_RANKS.TWO_PAIR, highCards: [...pairs, kicker] };
    }

    if (countValues[0][1] === 2) {
        const pairValue = Number(countValues[0][0]);
        const kickers = values.filter(v => v !== pairValue);
        return { rank: HAND_RANKS.ONE_PAIR, highCards: [pairValue, ...kickers] };
    }

    return { rank: HAND_RANKS.HIGH_CARD, highCards: values };
};

// Get all 5-card combinations from 7 cards
const getCombinations = (cards: Card[], size: number): Card[][] => {
    const result: Card[][] = [];

    const combine = (start: number, combo: Card[]) => {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < cards.length; i++) {
            combo.push(cards[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    };

    combine(0, []);
    return result;
};

// Evaluate best 5-card hand from 7 cards (2 hole + 5 community)
const evaluateBestHand = (holeCards: Card[], communityCards: Card[]): { rank: number; highCards: number[] } => {
    const allCards = [...holeCards, ...communityCards];
    const combinations = getCombinations(allCards, 5);

    let bestHand = { rank: 0, highCards: [0] };

    for (const combo of combinations) {
        const hand = evaluate5Cards(combo);
        // Compare hands
        if (hand.rank > bestHand.rank) {
            bestHand = hand;
        } else if (hand.rank === bestHand.rank) {
            // Compare high cards
            for (let i = 0; i < hand.highCards.length; i++) {
                if (hand.highCards[i] > (bestHand.highCards[i] || 0)) {
                    bestHand = hand;
                    break;
                } else if (hand.highCards[i] < (bestHand.highCards[i] || 0)) {
                    break;
                }
            }
        }
    }

    return bestHand;
};

// Compare two hands, return 1 if hand1 wins, -1 if hand2 wins, 0 if tie
const compareHands = (hand1: { rank: number; highCards: number[] }, hand2: { rank: number; highCards: number[] }): number => {
    if (hand1.rank !== hand2.rank) {
        return hand1.rank > hand2.rank ? 1 : -1;
    }

    // Same rank, compare high cards
    for (let i = 0; i < Math.max(hand1.highCards.length, hand2.highCards.length); i++) {
        const h1 = hand1.highCards[i] || 0;
        const h2 = hand2.highCards[i] || 0;
        if (h1 !== h2) {
            return h1 > h2 ? 1 : -1;
        }
    }

    return 0; // Tie
};

export interface LeaderboardEntry {
    playerName: string;
    chips: number;
    chainId: string;
}

export interface PokerGameState {
    tableId: string;
    tableName: string;
    players: PlayerInfo[];
    pot: number;
    communityCards: Card[];
    phase: string;
    currentBet: number;
    dealerPosition: number;
    currentPlayerIndex: number;
    playerCount: number;
    handNumber: number;
    handSeed: number;
    dealtCards?: {
        playerCards: Card[][];
        communityCards: Card[];
    };
    winner?: {
        name: string;
        amount: number;
        reason: 'fold' | 'showdown';
        handRank?: string; // e.g., "Two Pair", "Flush"
    };
    // Cards revealed at showdown (only when reason is 'showdown')
    showdownCards?: {
        playerName: string;
        cards: Card[];
        handRank: string;
    }[];
    // Leaderboard synced via WebSocket
    leaderboard?: LeaderboardEntry[];
}

export interface PlayerInfo {
    address: string;
    name: string;
    chips: number;
    status: string;
    currentBet: number;
    chainId?: string; // Player's actual chain ID
}

export interface Card {
    rank: string;
    suit: string;
    value: number;
}

export function usePokerGame(tableId: string) {
    const { application, owner, chainId, loading: lineraLoading, status } = useLinera();
    const [gameState, setGameState] = useState<PokerGameState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [myCards, setMyCards] = useState<Card[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const gameStateRef = useRef<PokerGameState | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    // Initialize default state
    const getDefaultState = useCallback((): PokerGameState => ({
        tableId,
        tableName: 'Poker Table',
        players: [],
        pot: 0,
        communityCards: [],
        phase: 'Waiting',
        currentBet: 0,
        dealerPosition: 0,
        currentPlayerIndex: 0,
        playerCount: 0,
        handNumber: 0,
        handSeed: 0,
    }), [tableId]);

    // Connect to WebSocket server
    const connectWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            setWsConnected(true);
            ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: tableId }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'STATE_UPDATE' && message.state) {
                    let receivedState = message.state;

                    // ============================================================
                    // VALIDATION: If game is in active phase but < 2 players,
                    // reset to Waiting phase (stale state from previous session)
                    // ============================================================
                    const activePhases = ['PreFlop', 'Flop', 'Turn', 'River', 'Showdown'];
                    const playerCount = receivedState.players?.length || 0;

                    if (activePhases.includes(receivedState.phase) && playerCount < 2) {
                        console.log('[WebSocket] ⚠️ Invalid state detected: phase', receivedState.phase, 'with only', playerCount, 'player(s). Resetting to Waiting.');
                        receivedState = {
                            ...receivedState,
                            phase: 'Waiting',
                            pot: 0,
                            currentBet: 0,
                            communityCards: [],
                            dealtCards: undefined,
                            winner: undefined,
                            players: receivedState.players?.map((p: PlayerInfo) => ({
                                ...p,
                                currentBet: 0,
                                status: 'Active',
                            })) || [],
                        };
                    }

                    setGameState(receivedState);
                    // Sync leaderboard from received state (sync across browsers via WebSocket)
                    if (receivedState.leaderboard && receivedState.leaderboard.length > 0) {
                        syncLeaderboardFromState(receivedState.leaderboard);
                    }
                    // Also update from players
                    if (receivedState.players && receivedState.players.length > 0) {
                        updateLocalLeaderboard(receivedState.players);
                    }
                } else if (message.type === 'ROOM_RESET') {
                    setGameState(getDefaultState());
                    setMyCards([]);
                } else if (message.type === 'ROOM_COUNTS') {
                    // Dispatch custom event for lobby to receive room counts
                    window.dispatchEvent(new CustomEvent('room-counts-update', { detail: message.counts }));
                }
            } catch (err) {
                // Silent error handling
            }
        };

        ws.onclose = () => {
            setWsConnected(false);
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = () => {
            // Silent error handling
        };

        wsRef.current = ws;
    }, [tableId, getDefaultState]);

    // Helper to send GraphQL mutation via HTTP (DeadKeys pattern)
    const sendHttpMutation = useCallback(async (chainId: string, appId: string, mutation: string): Promise<any> => {
        const url = `${SERVICE_URL}/chains/${chainId}/applications/${appId}`;
        console.log('[Linera HTTP] 📤 Sending to:', url);
        console.log('[Linera HTTP] Query:', mutation);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation }),
        });

        if (!response.ok) {
            console.error('[Linera HTTP] ❌ Error:', response.status, response.statusText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[Linera HTTP] 📥 Response:', result);
        return result;
    }, []);

    // Update blockchain leaderboard for a single player (local + Arena)
    // Submit DIRECTLY to Arena via HTTP - bypasses cross-chain messaging for immediate updates
    const updateBlockchainLeaderboard = useCallback(async (playerName: string, chips: number, playerChainId?: string, handsWon?: number, handsPlayed?: number, biggestPot?: number) => {
        if (chips <= 0) {
            console.log('[Leaderboard] Skipping update - chips <= 0', { chips });
            return;
        }

        const leaderboardChainId = playerChainId || chainId || '';
        console.log('[Leaderboard] updateBlockchainLeaderboard called - player:', playerName, 'chips:', chips, 'chainId:', leaderboardChainId);

        try {
            // 1. Update local Poker leaderboard via HTTP
            const localMutation = `mutation { updateLeaderboard(playerName: "${playerName}", chips: ${chips}, chainId: "${leaderboardChainId}") }`;
            console.log('[Leaderboard] Sending local update via HTTP:', localMutation);
            await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, localMutation);
            console.log('[Leaderboard] Local update sent');

            // 2. Submit DIRECTLY to Arena via HTTP (bypasses cross-chain messaging)
            // Uses the new submitStats mutation on Arena service for immediate updates
            const arenaMutation = `mutation { submitStats(chainId: "${leaderboardChainId}", name: "${playerName}", chips: ${chips}, handsWon: ${handsWon || 0}, handsPlayed: ${handsPlayed || 0}, biggestPot: ${biggestPot || 0}) }`;
            console.log('[Leaderboard] Sending DIRECT Arena update via HTTP:', arenaMutation);
            await sendHttpMutation(ARENA_CHAIN_ID, ARENA_APP_ID, arenaMutation);
            console.log('[Leaderboard] Arena update sent DIRECTLY');

            console.log('[Leaderboard] Both local and Arena updates completed');
        } catch (err) {
            console.error('[Leaderboard] Blockchain update error:', err);
        }
    }, [chainId, sendHttpMutation]);

    // Broadcast state update to all players
    const broadcastState = useCallback((newState: PokerGameState) => {
        // Update local leaderboard cache
        if (newState.players && newState.players.length > 0) {
            updateLocalLeaderboard(newState.players);
        }

        // Update blockchain leaderboard in important moments
        if (newState.players && newState.players.length > 0) {
            // Update when there's a winner
            if (newState.phase === 'Winner' && newState.winner) {
                const winner = newState.players.find(p => p.name === newState.winner?.name);
                if (winner && winner.chips > 0) {
                    // Winner gets +1 hand won, pot amount as biggest pot
                    // Use chainId field if available, otherwise fall back to address
                    const winnerChainId = winner.chainId || winner.address;
                    console.log('[Leaderboard] Winner update - name:', winner.name, 'chainId:', winnerChainId, 'winner object:', winner);
                    updateBlockchainLeaderboard(
                        winner.name,
                        winner.chips,
                        winnerChainId,
                        1, // handsWon
                        1, // handsPlayed
                        newState.winner.amount // biggestPot
                    );
                }
            }
            // Also update all players when game ends (ReadyForNextHand or GameOver)
            if (newState.phase === 'ReadyForNextHand' || newState.phase === 'GameOver') {
                newState.players.forEach(p => {
                    if (p.chips > 0) {
                        // Use chainId field if available, otherwise fall back to address
                        const playerChainId = p.chainId || p.address;
                        console.log('[Leaderboard] Player update - name:', p.name, 'chainId:', playerChainId, 'player object:', p);
                        updateBlockchainLeaderboard(p.name, p.chips, playerChainId, 0, 1, 0);
                    }
                });
            }
        }

        // Build leaderboard from globalLeaderboard for sync
        const leaderboardEntries: LeaderboardEntry[] = [];
        globalLeaderboard.forEach((value, key) => {
            leaderboardEntries.push({
                playerName: key,
                chips: value.chips,
                chainId: value.chainId,
            });
        });
        // Sort by chips descending
        leaderboardEntries.sort((a, b) => b.chips - a.chips);

        // Include leaderboard in state for WebSocket sync
        const stateWithLeaderboard: PokerGameState = {
            ...newState,
            leaderboard: leaderboardEntries.slice(0, 10),
        };

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'UPDATE_STATE',
                roomId: tableId,
                state: stateWithLeaderboard,
            }));
        }
        setGameState(stateWithLeaderboard);
    }, [tableId, updateBlockchainLeaderboard]);

    // Initialize WebSocket connection
    useEffect(() => {
        setGameState(getDefaultState());
        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [tableId, connectWebSocket, getDefaultState]);

    // Sync game state FROM blockchain
    const syncWithBlockchain = useCallback(async () => {
        if (!application) return null;

        try {
            const response = await application.query(
                JSON.stringify({
                    query: `query { 
                        gameTable(tableId: "${tableId}") { 
                            tableId
                            tableName
                            phase
                            pot
                            currentBet
                            dealerPosition
                            currentPlayerIndex
                            playerCount
                            players {
                                address
                                name
                                chips
                                status
                                currentBet
                            }
                            communityCards {
                                rank
                                suit
                            }
                        } 
                    }`
                })
            );
            const data = JSON.parse(response);

            if (data?.data?.gameTable) {
                const bcState = data.data.gameTable;
                const blockchainState: PokerGameState = {
                    tableId: bcState.tableId || tableId,
                    tableName: bcState.tableName || 'Poker Table',
                    players: (bcState.players || []).map((p: any) => ({
                        address: p.address,
                        name: p.name,
                        chips: parseInt(p.chips) || 0,
                        status: p.status?.replace(/"/g, '') || 'Active',
                        currentBet: parseInt(p.currentBet) || 0,
                    })),
                    pot: parseInt(bcState.pot) || 0,
                    communityCards: (bcState.communityCards || []).map((c: any) => ({
                        rank: c.rank?.replace(/"/g, '') || '2',
                        suit: c.suit?.toLowerCase() || 'hearts',
                        value: 0,
                    })),
                    phase: bcState.phase?.replace(/"/g, '') || 'Waiting',
                    currentBet: parseInt(bcState.currentBet) || 0,
                    dealerPosition: bcState.dealerPosition || 0,
                    currentPlayerIndex: bcState.currentPlayerIndex || 0,
                    playerCount: bcState.playerCount || 0,
                    handNumber: 0,
                    handSeed: 0,
                };
                return blockchainState;
            }
            return null;
        } catch (err) {
            return null;
        }
    }, [application, tableId]);

    // Load initial state from blockchain
    const loadFromBlockchain = useCallback(async () => {
        const bcState = await syncWithBlockchain();
        if (bcState && bcState.players.length > 0) {
            setGameState(bcState);
            broadcastState(bcState);
        }
    }, [syncWithBlockchain, broadcastState]);

    // Create table (no-op, table created at deployment)
    const createTable = useCallback(
        async (_tableId: string, _smallBlind: number, _bigBlind: number, _buyIn: number) => {
            // Table ready
        },
        []
    );

    // Join table
    const joinTable = useCallback(
        async (playerName: string, buyIn: number = 1000): Promise<boolean> => {
            setIsLoading(true);
            setError(null);

            try {
                // Request latest state from server first
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'GET_STATE', roomId: tableId }));
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const currentState = gameStateRef.current || getDefaultState();

                // Check if player already exists
                if (currentState.players.some(p => p.name === playerName)) {
                    setIsLoading(false);
                    return true;
                }

                // Check max players
                if (currentState.players.length >= 4) {
                    setError('Table is full');
                    setIsLoading(false);
                    return false;
                }

                // ============================================================
                // HYBRID APPROACH: Get player chips with priority
                // 1. Arena blockchain (primary source of truth)
                // 2. localStorage (fallback)
                // 3. New player bonus (only for Rookie Lounge)
                // ============================================================
                console.log('[JoinTable] Getting player chips with hybrid approach...');

                const ROOKIE_LOUNGE_BUYIN = 1000; // Rookie Lounge min buy-in
                const NEW_PLAYER_BONUS = 1000; // Free chips for new players

                let playerChips = 0;
                let isExistingPlayer = false;

                // Priority 1: Query from Arena blockchain
                const arenaChips = await getPlayerChipsFromArena(playerName);
                if (arenaChips !== null && arenaChips > 0) {
                    playerChips = arenaChips;
                    isExistingPlayer = true;
                    console.log('[JoinTable] Using chips from Arena blockchain:', playerChips);
                } else {
                    // Priority 2: Check localStorage
                    const localChips = getPlayerChipsFromLocalStorage(playerName);
                    if (localChips !== null && localChips > 0) {
                        playerChips = localChips;
                        isExistingPlayer = true;
                        console.log('[JoinTable] Using chips from localStorage:', playerChips);
                    } else {
                        // Priority 3: New player - no chips yet
                        console.log('[JoinTable] New player detected, no existing chips');
                    }
                }

                // ============================================================
                // VALIDATION: Room access rules
                // - New players: Can ONLY join Rookie Lounge, get 1000 free chips
                // - Existing players: Must have >= min buy-in for the room
                // ============================================================
                if (!isExistingPlayer) {
                    // New player - can only join Rookie Lounge
                    if (buyIn !== ROOKIE_LOUNGE_BUYIN) {
                        const errorMsg = `New players can only join Rookie Lounge! Play there first to earn chips.`;
                        console.log('[JoinTable] ❌', errorMsg);
                        setError(errorMsg);
                        setIsLoading(false);
                        return false;
                    }
                    // Give new player bonus chips
                    playerChips = NEW_PLAYER_BONUS;
                    console.log('[JoinTable] 🎁 New player bonus:', playerChips, 'chips');
                } else {
                    // Existing player - check if they have enough chips
                    if (playerChips < buyIn) {
                        const errorMsg = `Insufficient chips! You have ${playerChips.toLocaleString()} chips but this room requires minimum ${buyIn.toLocaleString()} chips.`;
                        console.log('[JoinTable] ❌', errorMsg);
                        setError(errorMsg);
                        setIsLoading(false);
                        return false;
                    }
                }

                // Add player to state
                const playerChainIdValue = chainId || '';
                console.log('[JoinTable] Creating player - name:', playerName, 'chips:', playerChips, 'chainId:', playerChainIdValue);

                const newPlayer: PlayerInfo = {
                    address: chainId || playerName,
                    name: playerName,
                    chips: playerChips,
                    status: 'Active',
                    currentBet: 0,
                    chainId: playerChainIdValue, // Store actual chain ID
                };

                const newState: PokerGameState = {
                    ...currentState,
                    players: [...currentState.players, newPlayer],
                    playerCount: currentState.players.length + 1,
                };

                broadcastState(newState);

                // Update leaderboard with player chips (include chainId)
                const playerChainId = chainId || playerName;
                updateBlockchainLeaderboard(playerName, playerChips, playerChainId);

                // Save to blockchain via HTTP (DeadKeys pattern)
                try {
                    const joinMutation = `mutation { joinTable(tableId: "${tableId}", playerName: "${playerName}", buyIn: ${buyIn}) }`;
                    await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, joinMutation);
                    console.log('[Poker] joinTable sent via HTTP');
                } catch (err) {
                    console.warn('[Poker] HTTP joinTable failed, trying application.query');
                    if (application) {
                        try {
                            await application.query(
                                JSON.stringify({
                                    query: `mutation { joinTable(tableId: "${tableId}", playerName: "${playerName}", buyIn: ${buyIn}) }`
                                })
                            );
                        } catch (fallbackErr) {
                            // Silent blockchain error
                        }
                    }
                }

                return true;
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to join table';
                setError(errorMsg);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [application, tableId, chainId, getDefaultState, broadcastState, updateBlockchainLeaderboard, sendHttpMutation]
    );

    // Helper to generate random cards
    const generateRandomCards = useCallback((count: number, seed?: number): Card[] => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const cards: Card[] = [];

        // Use seed for deterministic generation across all clients
        let rng = seed || Date.now();
        const random = () => {
            rng = (rng * 1103515245 + 12345) & 0x7fffffff;
            return rng / 0x7fffffff;
        };

        for (let i = 0; i < count; i++) {
            cards.push({
                rank: ranks[Math.floor(random() * ranks.length)],
                suit: suits[Math.floor(random() * suits.length)],
                value: 0,
            });
        }
        return cards;
    }, []);

    // Start game
    const startGame = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const currentState = gameStateRef.current || getDefaultState();

            if (currentState.players.length < 2) {
                setError('Need at least 2 players to start');
                setIsLoading(false);
                return;
            }

            // Generate deterministic seed for this hand
            const newHandNumber = (currentState.handNumber || 0) + 1;
            const playerAddresses = currentState.players.map(p => p.address);
            const handSeed = generateHandSeed(tableId, newHandNumber, playerAddresses);

            // Shuffle deck and deal cards
            const shuffledDeck = shuffleDeck(handSeed);
            const dealt = dealCards(shuffledDeck, currentState.players.length);

            // Calculate positions relative to dealer
            const numPlayers = currentState.players.length;
            const newDealerPosition = (currentState.dealerPosition + 1) % numPlayers;

            // In heads-up (2 players): Dealer = Small Blind, other = Big Blind
            // In 3+ players: Dealer, then SB (dealer+1), then BB (dealer+2)
            const smallBlindPos = numPlayers === 2 ? newDealerPosition : (newDealerPosition + 1) % numPlayers;
            const bigBlindPos = numPlayers === 2 ? (newDealerPosition + 1) % numPlayers : (newDealerPosition + 2) % numPlayers;

            // First to act in PreFlop:
            // Heads-up: Small Blind (Dealer) acts first
            // 3+ players: UTG (player after Big Blind) acts first
            const firstToAct = numPlayers === 2 ? smallBlindPos : (bigBlindPos + 1) % numPlayers;

            // Get blind amounts from room (default 10/20)
            const smallBlindAmount = 10;
            const bigBlindAmount = 20;

            // Start with PreFlop - NO community cards yet
            const newState: PokerGameState = {
                ...currentState,
                phase: 'PreFlop',
                pot: smallBlindAmount + bigBlindAmount,
                currentBet: bigBlindAmount,
                dealerPosition: newDealerPosition,
                currentPlayerIndex: firstToAct,
                communityCards: [], // NO community cards in PreFlop!
                handNumber: newHandNumber,
                handSeed: handSeed,
                dealtCards: dealt, // Store dealt cards for revealing later
                players: currentState.players.map((p, idx) => {
                    // Post blinds based on position relative to dealer
                    if (idx === smallBlindPos) {
                        // Small blind
                        return { ...p, chips: p.chips - smallBlindAmount, currentBet: smallBlindAmount, status: 'Active' };
                    } else if (idx === bigBlindPos) {
                        // Big blind
                        return { ...p, chips: p.chips - bigBlindAmount, currentBet: bigBlindAmount, status: 'Active' };
                    }
                    return { ...p, currentBet: 0, status: 'Active' };
                }),
            };

            console.log('[StartGame] Positions - Dealer:', newDealerPosition, 'SB:', smallBlindPos, 'BB:', bigBlindPos, 'First to act:', firstToAct);

            broadcastState(newState);

            // Record on blockchain via HTTP
            try {
                await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, `mutation { startHand }`);
                console.log('[Poker] startHand sent via HTTP');
            } catch (err) {
                console.warn('[Poker] HTTP startHand failed, trying application.query');
                if (application) {
                    try {
                        await application.query(JSON.stringify({ query: `mutation { startHand }` }));
                    } catch (fallbackErr) {
                        // Silent blockchain error
                    }
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to start game';
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }, [application, getDefaultState, broadcastState, sendHttpMutation]);

    // Perform action
    const performAction = useCallback(
        async (action: any, playerName?: string) => {
            setIsLoading(true);
            setError(null);

            const name = playerName || owner || 'Player';
            const currentState = gameStateRef.current || getDefaultState();

            try {
                let actionStr = 'check';
                let amount = 0;

                if (typeof action === 'string') {
                    actionStr = action.toLowerCase();
                } else if (action && typeof action === 'object') {
                    if (action.Raise) {
                        actionStr = 'raise';
                        amount = action.Raise.amount || 0;
                    } else if (action.Fold) {
                        actionStr = 'fold';
                    } else if (action.Check) {
                        actionStr = 'check';
                    } else if (action.Call) {
                        actionStr = 'call';
                    } else if (action.AllIn) {
                        actionStr = 'allin';
                    }
                }

                console.log(`[Action] ${name} performs ${actionStr.toUpperCase()}${amount > 0 ? ` (amount: ${amount})` : ''}`);
                console.log('[Action] Current state:', {
                    phase: currentState.phase,
                    pot: currentState.pot,
                    currentBet: currentState.currentBet,
                    players: currentState.players.map(p => ({ name: p.name, chips: p.chips, currentBet: p.currentBet, status: p.status }))
                });

                // Find the player performing the action
                const actingPlayer = currentState.players.find(p => p.name === name);
                if (!actingPlayer) {
                    console.warn('[Action] Player not found:', name);
                    setIsLoading(false);
                    return;
                }

                console.log('[Action] Acting player:', { name: actingPlayer.name, chips: actingPlayer.chips, currentBet: actingPlayer.currentBet });

                // Validate player has chips (except for fold/check)
                if (actingPlayer.chips <= 0 && !['fold', 'check'].includes(actionStr)) {
                    console.warn('[Action] Player has no chips, forcing fold');
                    actionStr = 'fold';
                }

                // Calculate pot increase based on action
                let potIncrease = 0;
                let newTableBet = currentState.currentBet;

                // Pre-calculate call amount for blockchain (before map)
                if (actionStr === 'call') {
                    const callAmount = Math.min(actingPlayer.chips, Math.max(0, currentState.currentBet - actingPlayer.currentBet));
                    amount = callAmount; // Set amount for blockchain call
                    console.log('[Action] Pre-calculated CALL amount:', callAmount);
                }

                // Update player state based on action
                const updatedPlayers = currentState.players.map(p => {
                    if (p.name === name) {
                        switch (actionStr) {
                            case 'fold':
                                return { ...p, status: 'Folded' };
                            case 'check':
                                return p;
                            case 'call': {
                                const callAmount = Math.min(p.chips, Math.max(0, currentState.currentBet - p.currentBet));
                                console.log('[Action] CALL - player:', p.name, 'tableBet:', currentState.currentBet, 'playerCurrentBet:', p.currentBet, 'callAmount:', callAmount, 'playerChips:', p.chips);
                                potIncrease = callAmount;
                                const newChips = Math.max(0, p.chips - callAmount);
                                return {
                                    ...p,
                                    chips: newChips,
                                    currentBet: p.currentBet + callAmount,
                                    status: newChips === 0 ? 'AllIn' : p.status,
                                };
                            }
                            case 'raise':
                            case 'bet': {
                                const callFirst = Math.max(0, currentState.currentBet - p.currentBet);
                                const maxRaise = Math.max(0, p.chips - callFirst);
                                const actualRaise = Math.min(amount, maxRaise);
                                const totalBet = Math.min(p.chips, callFirst + actualRaise);
                                potIncrease = totalBet;
                                newTableBet = p.currentBet + totalBet;
                                const newChips = Math.max(0, p.chips - totalBet);
                                return {
                                    ...p,
                                    chips: newChips,
                                    currentBet: p.currentBet + totalBet,
                                    status: newChips === 0 ? 'AllIn' : p.status,
                                };
                            }
                            case 'allin': {
                                const allInAmount = Math.max(0, p.chips);
                                potIncrease = allInAmount;
                                const newPlayerBet = p.currentBet + allInAmount;
                                if (newPlayerBet > currentState.currentBet) {
                                    newTableBet = newPlayerBet;
                                }
                                return {
                                    ...p,
                                    chips: 0,
                                    currentBet: newPlayerBet,
                                    status: 'AllIn',
                                };
                            }
                            default:
                                return p;
                        }
                    }
                    return p;
                });

                // Log action result
                console.log('[Action] Result:', {
                    potIncrease,
                    newTableBet,
                    newPot: currentState.pot + potIncrease,
                    updatedPlayers: updatedPlayers.map(p => ({ name: p.name, chips: p.chips, currentBet: p.currentBet, status: p.status }))
                });

                // Send action to blockchain using application.query (like DeadKeys pattern)
                // This will show DEBUG logs in browser console from Linera WASM client
                if (application) {
                    try {
                        console.log('[Blockchain] 📤 Sending playerAction via application.query:', actionStr, 'player:', name, 'amount:', amount);
                        const resp = await application.query(
                            JSON.stringify({
                                query: `mutation { playerAction(action: "${actionStr}", playerName: "${name}", amount: ${amount}) }`
                            })
                        );
                        console.log('[Blockchain] 📥 playerAction response:', resp);
                        const result = JSON.parse(resp);
                        console.log('[Blockchain] ✅ playerAction result:', result);
                    } catch (err) {
                        console.error('[Blockchain] ❌ playerAction failed:', err);
                        // Fallback to HTTP if application.query fails
                        try {
                            const actionMutation = `mutation { playerAction(action: "${actionStr}", playerName: "${name}", amount: ${amount}) }`;
                            await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, actionMutation);
                            console.log('[Blockchain] 📥 playerAction via HTTP fallback');
                        } catch (httpErr) {
                            console.error('[Blockchain] ❌ HTTP fallback also failed:', httpErr);
                        }
                    }
                } else {
                    console.warn('[Blockchain] ⚠️ No application connected, skipping blockchain call');
                }

                // Check for winner (only one player left not folded)
                const playersStillIn = updatedPlayers.filter(p => p.status !== 'Folded');
                if (playersStillIn.length === 1) {
                    const winner = playersStillIn[0];
                    const totalPot = currentState.pot + potIncrease;

                    console.log('[Action] 🏆 WINNER by fold:', winner.name, 'wins pot:', totalPot);

                    const finalPlayers = updatedPlayers.map(p => {
                        if (p.name === winner.name) {
                            return { ...p, chips: p.chips + totalPot, currentBet: 0, status: 'Active' };
                        }
                        return { ...p, currentBet: 0, status: p.chips > 0 ? 'Active' : 'Folded' };
                    });

                    console.log('[Action] Final chips:', finalPlayers.map(p => ({ name: p.name, chips: p.chips })));

                    // Show winner phase first, then auto-reset after delay
                    const winState: PokerGameState = {
                        ...currentState,
                        players: finalPlayers,
                        pot: 0,
                        currentBet: 0,
                        phase: 'Winner',
                        communityCards: currentState.communityCards,
                        winner: {
                            name: winner.name,
                            amount: totalPot,
                            reason: 'fold',
                        },
                    };

                    broadcastState(winState);

                    // Check how many players still have chips
                    const playersWithChips = finalPlayers.filter(p => p.chips > 0);

                    // After 5 seconds, decide next action
                    setTimeout(() => {
                        if (playersWithChips.length > 1) {
                            // Multiple players still have chips - ready for next hand
                            const nextHandState: PokerGameState = {
                                ...winState,
                                phase: 'ReadyForNextHand',
                                communityCards: [],
                                winner: undefined,
                                players: finalPlayers.map(p => ({
                                    ...p,
                                    status: p.chips > 0 ? 'Active' : 'Out',
                                    currentBet: 0,
                                })),
                            };
                            broadcastState(nextHandState);
                        } else {
                            // Only one player has chips - game over, back to waiting
                            const gameOverState: PokerGameState = {
                                ...winState,
                                phase: 'GameOver',
                                communityCards: [],
                                winner: {
                                    ...winState.winner!,
                                    reason: 'fold',
                                },
                            };
                            broadcastState(gameOverState);

                            // Reset to waiting after showing game over
                            setTimeout(() => {
                                const resetState: PokerGameState = {
                                    ...gameOverState,
                                    phase: 'Waiting',
                                    winner: undefined,
                                    players: [],
                                    playerCount: 0,
                                };
                                broadcastState(resetState);
                            }, 5000);
                        }
                    }, 5000);

                    setIsLoading(false);
                    return;
                }

                // Move to next active player
                const activePlayers = updatedPlayers.filter(p => p.status === 'Active' || p.status === 'AllIn');
                const currentPlayerIdx = activePlayers.findIndex(p => p.name === name);
                const nextPlayerIndex = activePlayers.length > 0
                    ? (currentPlayerIdx + 1) % activePlayers.length
                    : 0;

                // Check if betting round is complete
                // All active players must have matched the current bet (or be all-in)
                const allPlayersMatched = activePlayers.every(p =>
                    p.currentBet === newTableBet || p.status === 'AllIn'
                );

                // Betting round is complete when:
                // 1. All players have matched the bet AND
                // 2. The action was a "closing" action (check, call, fold) - not a raise
                // A raise reopens the betting, so we don't advance phase after a raise
                const isClosingAction = ['check', 'call', 'fold'].includes(actionStr);
                const bettingRoundComplete = allPlayersMatched && isClosingAction;

                console.log('[Phase] Checking phase transition:', {
                    currentPhase: currentState.phase,
                    action: actionStr,
                    allPlayersMatched,
                    isClosingAction,
                    bettingRoundComplete,
                    nextPlayerIndex,
                    activePlayers: activePlayers.map(p => ({ name: p.name, currentBet: p.currentBet, status: p.status })),
                    newTableBet,
                });

                let newPhase = currentState.phase;
                let newCommunityCards = [...currentState.communityCards];
                let resetBets = false;

                // If betting round is complete, advance phase
                if (bettingRoundComplete && activePlayers.length > 1) {
                    console.log('[Phase] ✅ Advancing phase from', currentState.phase);
                    const phases = ['PreFlop', 'Flop', 'Turn', 'River', 'Showdown'];
                    const currentPhaseIdx = phases.indexOf(currentState.phase);

                    if (currentPhaseIdx < phases.length - 1) {
                        newPhase = phases[currentPhaseIdx + 1];
                        resetBets = true;

                        // Use pre-dealt community cards from shuffled deck
                        const preDealtCards = currentState.dealtCards?.communityCards || [];

                        // Deal community cards based on phase transition
                        if (newPhase === 'Flop' && newCommunityCards.length === 0) {
                            newCommunityCards = preDealtCards.slice(0, 3);
                        } else if (newPhase === 'Turn' && newCommunityCards.length === 3) {
                            if (preDealtCards[3]) {
                                newCommunityCards.push(preDealtCards[3]);
                            }
                        } else if (newPhase === 'River' && newCommunityCards.length === 4) {
                            if (preDealtCards[4]) {
                                newCommunityCards.push(preDealtCards[4]);
                            }
                        } else if (newPhase === 'Showdown') {
                            const playersInShowdown = updatedPlayers.filter(p => p.status !== 'Folded');
                            if (playersInShowdown.length > 0) {
                                // Evaluate each player's hand and find the winner
                                const playerHands = playersInShowdown.map((player) => {
                                    // Get player's hole cards from dealtCards
                                    const playerIdx = updatedPlayers.findIndex(p => p.name === player.name);
                                    const holeCards = currentState.dealtCards?.playerCards?.[playerIdx] || [];
                                    const bestHand = evaluateBestHand(holeCards, newCommunityCards);

                                    console.log('[Showdown] Player:', player.name, 'Hand rank:', bestHand.rank, 'High cards:', bestHand.highCards);

                                    return {
                                        player,
                                        holeCards,
                                        bestHand,
                                    };
                                });

                                // Find the winner(s) - could be multiple in case of tie
                                let winners = [playerHands[0]];
                                for (let i = 1; i < playerHands.length; i++) {
                                    const comparison = compareHands(playerHands[i].bestHand, winners[0].bestHand);
                                    if (comparison > 0) {
                                        // New winner
                                        winners = [playerHands[i]];
                                    } else if (comparison === 0) {
                                        // Tie - add to winners
                                        winners.push(playerHands[i]);
                                    }
                                }

                                // For now, just take first winner (TODO: split pot for ties)
                                const winner = winners[0].player;
                                const winnerHandRank = getHandRankName(winners[0].bestHand.rank);
                                const totalPot = currentState.pot + potIncrease;

                                console.log('[Showdown] 🏆 Winner:', winner.name, 'with', winnerHandRank);

                                // Build showdown cards for ALL players in showdown (reveal their cards)
                                const showdownCards = playerHands.map(ph => ({
                                    playerName: ph.player.name,
                                    cards: ph.holeCards,
                                    handRank: getHandRankName(ph.bestHand.rank),
                                }));

                                // Award pot to winner
                                const showdownPlayers = updatedPlayers.map(p => {
                                    if (p.name === winner.name) {
                                        return { ...p, chips: p.chips + totalPot, currentBet: 0, status: 'Active' };
                                    }
                                    return { ...p, currentBet: 0, status: p.chips > 0 ? 'Active' : 'Folded' };
                                });

                                // Show winner phase with all community cards and player cards visible
                                const showdownState: PokerGameState = {
                                    ...currentState,
                                    players: showdownPlayers,
                                    pot: 0,
                                    currentBet: 0,
                                    phase: 'Winner',
                                    communityCards: newCommunityCards,
                                    currentPlayerIndex: 0,
                                    winner: {
                                        name: winner.name,
                                        amount: totalPot,
                                        reason: 'showdown',
                                        handRank: winnerHandRank,
                                    },
                                    showdownCards, // Reveal all player cards at showdown
                                };

                                broadcastState(showdownState);

                                // Check how many players still have chips
                                const playersWithChips = showdownPlayers.filter(p => p.chips > 0);

                                // After 5 seconds, decide next action
                                setTimeout(() => {
                                    if (playersWithChips.length > 1) {
                                        // Multiple players still have chips - ready for next hand
                                        const nextHandState: PokerGameState = {
                                            ...showdownState,
                                            phase: 'ReadyForNextHand',
                                            communityCards: [],
                                            winner: undefined,
                                            players: showdownPlayers.map(p => ({
                                                ...p,
                                                status: p.chips > 0 ? 'Active' : 'Out',
                                                currentBet: 0,
                                            })),
                                        };
                                        broadcastState(nextHandState);
                                    } else {
                                        // Only one player has chips - game over
                                        const gameOverState: PokerGameState = {
                                            ...showdownState,
                                            phase: 'GameOver',
                                            communityCards: [],
                                            winner: {
                                                ...showdownState.winner!,
                                                reason: 'showdown',
                                            },
                                        };
                                        broadcastState(gameOverState);

                                        // Reset to waiting after showing game over
                                        setTimeout(() => {
                                            const resetState: PokerGameState = {
                                                ...gameOverState,
                                                phase: 'Waiting',
                                                winner: undefined,
                                                players: [],
                                                playerCount: 0,
                                            };
                                            broadcastState(resetState);
                                        }, 5000);
                                    }
                                }, 5000);

                                setIsLoading(false);
                                return;
                            }
                        }

                    }
                }

                // Reset player bets if advancing phase
                const finalPlayers = resetBets
                    ? updatedPlayers.map(p => ({ ...p, currentBet: 0 }))
                    : updatedPlayers;

                // Determine first-to-act for new phase
                let newCurrentPlayerIndex = nextPlayerIndex;
                if (resetBets && newPhase !== 'Showdown') {
                    // After Flop/Turn/River: First active player after dealer acts first
                    // Find first active player starting from position after dealer
                    const numPlayers = finalPlayers.length;
                    const dealerPos = currentState.dealerPosition;

                    for (let i = 1; i <= numPlayers; i++) {
                        const checkPos = (dealerPos + i) % numPlayers;
                        const player = finalPlayers[checkPos];
                        if (player && (player.status === 'Active' || player.status === 'AllIn')) {
                            newCurrentPlayerIndex = checkPos;
                            break;
                        }
                    }
                    console.log('[Phase] Post-flop first to act:', newCurrentPlayerIndex, '(dealer at', dealerPos, ')');
                }

                const newState: PokerGameState = {
                    ...currentState,
                    players: finalPlayers,
                    pot: currentState.pot + potIncrease,
                    currentBet: resetBets ? 0 : newTableBet,
                    currentPlayerIndex: newCurrentPlayerIndex,
                    phase: newPhase,
                    communityCards: newCommunityCards,
                };

                broadcastState(newState);
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to perform action';
                setError(errorMsg);
            } finally {
                setIsLoading(false);
            }
        },
        [application, owner, getDefaultState, broadcastState, syncWithBlockchain, sendHttpMutation]
    );

    // Leave table
    const leaveTable = useCallback(async (playerName?: string) => {
        const name = playerName || owner || 'Player';
        const currentState = gameStateRef.current || getDefaultState();

        try {
            const newState: PokerGameState = {
                ...currentState,
                players: currentState.players.filter(p => p.name !== name),
                playerCount: Math.max(0, currentState.playerCount - 1),
            };

            broadcastState(newState);

            // Record on blockchain via HTTP
            try {
                const leaveMutation = `mutation { leaveTable(tableId: "${tableId}", playerName: "${name}") }`;
                await sendHttpMutation(POKER_CHAIN_ID, POKER_APP_ID, leaveMutation);
            } catch (err) {
                // Fallback to application.query
                if (application) {
                    try {
                        await application.query(
                            JSON.stringify({
                                query: `mutation { leaveTable(tableId: "${tableId}", playerName: "${name}") }`
                            })
                        );
                    } catch (fallbackErr) {
                        // Silent blockchain error
                    }
                }
            }
        } catch (err) {
            // Silent error
        }
    }, [application, tableId, owner, getDefaultState, broadcastState, sendHttpMutation]);

    // Reset room - clear all state
    const resetRoom = useCallback(() => {

        // Send reset to WebSocket server
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'RESET_ROOM', roomId: tableId }));
        }

        // Reset local state
        const freshState = getDefaultState();
        setGameState(freshState);
        setMyCards([]);
        gameStateRef.current = freshState;
    }, [tableId, getDefaultState]);

    return {
        gameState,
        myCards,
        isLoading: isLoading || lineraLoading,
        error,
        isConnected: wsConnected,
        chainId,
        owner,
        createTable,
        joinTable,
        startGame,
        performAction,
        leaveTable,
        resetRoom,
        refetch: syncWithBlockchain,
    };
}
