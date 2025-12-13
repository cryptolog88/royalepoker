import { useState, useEffect, useCallback } from 'react';
import { useLinera } from '../contexts/LineraContext';

export interface LeaderboardPlayer {
    playerName: string;
    chips: number;
    chainId: string;
    rank: number;
}

// Global leaderboard storage (synced via WebSocket from usePokerGame)
export const globalLeaderboard = new Map<
    string,
    { name: string; chips: number; chainId: string; lastUpdated: number }
>();

// Subscribers for leaderboard updates
const leaderboardSubscribers = new Set<() => void>();

// Function to notify subscribers when leaderboard changes
export const notifyLeaderboardUpdate = () => {
    leaderboardSubscribers.forEach(callback => callback());
};

// Function to sync leaderboard from game state (called by usePokerGame)
export const syncLeaderboardFromState = (entries: { playerName: string; chips: number; chainId: string }[]) => {
    let changed = false;
    entries.forEach(entry => {
        const existing = globalLeaderboard.get(entry.playerName);
        if (!existing || entry.chips !== existing.chips) {
            globalLeaderboard.set(entry.playerName, {
                name: entry.playerName,
                chips: entry.chips,
                chainId: entry.chainId,
                lastUpdated: Date.now(),
            });
            changed = true;
        }
    });
    if (changed) {
        notifyLeaderboardUpdate();
    }
};

// Local storage key for leaderboard backup
// v2: Added proper chainId tracking per player
const LEADERBOARD_STORAGE_KEY = 'poker_leaderboard_v2';

// Load from localStorage
const loadLocalLeaderboard = (): Map<string, { chips: number; chainId: string }> => {
    try {
        const stored = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            return new Map(Object.entries(data));
        }
    } catch (e) {
        console.error('[Leaderboard] Failed to load from localStorage:', e);
    }
    return new Map();
};

// Save to localStorage
const saveLocalLeaderboard = (data: Map<string, { chips: number; chainId: string }>) => {
    try {
        const obj = Object.fromEntries(data);
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        console.error('[Leaderboard] Failed to save to localStorage:', e);
    }
};

export function useLeaderboard() {
    const { application, chainId: myChainId } = useLinera();
    const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [, forceUpdate] = useState(0);

    // Subscribe to leaderboard updates from WebSocket sync
    useEffect(() => {
        const handleUpdate = () => {
            forceUpdate(n => n + 1);
        };
        leaderboardSubscribers.add(handleUpdate);
        return () => {
            leaderboardSubscribers.delete(handleUpdate);
        };
    }, []);

    // Update leaderboard - use cross-chain submission to leaderboard chain
    const updatePlayerOnChain = useCallback(
        async (playerName: string, chips: number, chainId?: string) => {
            if (chips <= 0) return;

            const playerChainId = chainId || myChainId || '';

            // Save to local storage - always update with current chips
            const localCache = loadLocalLeaderboard();
            localCache.set(playerName, { chips, chainId: playerChainId });
            saveLocalLeaderboard(localCache);

            globalLeaderboard.set(playerName, {
                name: playerName,
                chips,
                chainId: playerChainId,
                lastUpdated: Date.now()
            });

            // Submit to Poker Arena via cross-chain message
            if (application) {
                try {
                    // Use submitToArena for cross-chain submission to global leaderboard
                    // Include player's actual chainId
                    const mutationQuery = `mutation { submitToArena(playerName: "${playerName}", chips: ${chips}, handsWon: 0, handsPlayed: 0, biggestPot: 0, chainId: "${playerChainId}") }`;
                    console.log('[Leaderboard] Submitting to Arena:', mutationQuery);
                    await application.query(JSON.stringify({ query: mutationQuery }));
                    console.log('[Leaderboard] Cross-chain submission to Arena sent');
                } catch (err) {
                    console.error('[Leaderboard] Arena submission error:', err);
                }
            }
        },
        [application, myChainId]
    );

    // Fetch leaderboard from blockchain and merge with local cache
    const fetchFromBlockchain = useCallback(async () => {
        setIsLoading(true);

        // Start with local cache data (reload fresh each time)
        const mergedData = new Map<string, { chips: number; chainId: string }>();
        const localCache = loadLocalLeaderboard();

        // Add data from localStorage
        localCache.forEach((value, key) => {
            mergedData.set(key, value);
        });

        console.log('[Leaderboard] Local cache entries:', localCache.size);
        console.log('[Leaderboard] Global leaderboard entries:', globalLeaderboard.size);

        // Add data from globalLeaderboard (in-memory) - use latest value
        globalLeaderboard.forEach((value, key) => {
            mergedData.set(key, { chips: value.chips, chainId: value.chainId });
        });

        // Try to fetch from blockchain
        if (application) {
            try {
                const queryStr = `query { leaderboard(limit: 10) { playerName chips chainId } }`;
                console.log('[Leaderboard] Fetching with query:', queryStr);

                const response = await application.query(
                    JSON.stringify({
                        query: queryStr,
                    })
                );
                console.log('[Leaderboard] Raw response:', response);

                const data = JSON.parse(response);
                console.log('[Leaderboard] Parsed data:', data);

                if (data?.data?.leaderboard && Array.isArray(data.data.leaderboard)) {
                    // Merge blockchain data - local/in-memory takes priority for current session
                    data.data.leaderboard.forEach((p: any) => {
                        const chips = typeof p.chips === 'string' ? parseInt(p.chips) : p.chips;
                        if (chips > 0) {
                            const existing = mergedData.get(p.playerName);
                            // Only use blockchain data if we don't have local data
                            if (!existing) {
                                mergedData.set(p.playerName, {
                                    chips,
                                    chainId: p.chainId || ''
                                });
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('[Leaderboard] Fetch error:', err);
            }
        }

        // Convert merged data to sorted array
        const players: LeaderboardPlayer[] = Array.from(mergedData.entries())
            .filter(([_, data]) => data.chips > 0)
            .sort((a, b) => b[1].chips - a[1].chips)
            .slice(0, 10)
            .map(([name, data], idx) => ({
                playerName: name,
                chips: data.chips,
                chainId: data.chainId,
                rank: idx + 1,
            }));

        console.log('[Leaderboard] Merged players:', players);
        setLeaderboard(players);
        setIsLoading(false);
    }, [application]);

    // Auto-refresh from blockchain
    useEffect(() => {
        fetchFromBlockchain();
        const interval = setInterval(fetchFromBlockchain, 5000);
        return () => clearInterval(interval);
    }, [fetchFromBlockchain]);

    // Test function to manually add a test entry via cross-chain message
    const testLeaderboard = useCallback(async () => {
        if (!application) {
            console.log('[Leaderboard] No application available for test');
            alert('No blockchain application connected!');
            return;
        }

        const testName = `Player_${Math.floor(Math.random() * 1000)}`;
        const testChips = 1000 + Math.floor(Math.random() * 500);

        console.log('[Leaderboard] ========== TEST START ==========');
        console.log('[Leaderboard] Testing cross-chain submission:', { testName, testChips });

        try {
            // Use submitToArena for cross-chain submission to global leaderboard
            // Include test chainId
            const testChainId = myChainId || 'test-chain';
            const mutationQuery = `mutation { submitToArena(playerName: "${testName}", chips: ${testChips}, handsWon: 1, handsPlayed: 1, biggestPot: ${testChips}, chainId: "${testChainId}") }`;
            console.log('[Leaderboard] Sending Arena mutation:', mutationQuery);

            const mutResult = await application.query(
                JSON.stringify({ query: mutationQuery })
            );
            console.log('[Leaderboard] Mutation response:', mutResult);

            const mutData = JSON.parse(mutResult);
            if (mutData.errors) {
                console.error('[Leaderboard] Mutation errors:', mutData.errors);
                alert('Mutation failed: ' + JSON.stringify(mutData.errors));
                return;
            }

            console.log('[Leaderboard] Cross-chain message sent! Waiting 5 seconds for processing...');
            alert('Cross-chain message sent! Waiting 5 seconds for the message to be processed on the leaderboard chain...');

            await new Promise(resolve => setTimeout(resolve, 5000));

            // Query leaderboard
            const queryStr = `query { leaderboard(limit: 10) { playerName chips chainId } }`;
            console.log('[Leaderboard] Querying leaderboard...');

            const queryResult = await application.query(
                JSON.stringify({ query: queryStr })
            );
            console.log('[Leaderboard] Query response:', queryResult);

            const queryData = JSON.parse(queryResult);
            const entries = queryData?.data?.leaderboard || [];
            console.log('[Leaderboard] Leaderboard entries:', entries);
            console.log('[Leaderboard] ========== TEST END ==========');

            if (entries.length > 0) {
                alert(`Success! Found ${entries.length} entries in leaderboard:\n${entries.map((e: any) => `${e.playerName}: ${e.chips}`).join('\n')}`);
            } else {
                alert('Leaderboard is still empty. Cross-chain messages may take a few more seconds to process.');
            }

        } catch (err) {
            console.error('[Leaderboard] Test error:', err);
            alert('Test failed: ' + (err instanceof Error ? err.message : String(err)));
        }
    }, [application]);

    return {
        leaderboard,
        isLoading,
        refetch: fetchFromBlockchain,
        updatePlayer: updatePlayerOnChain,
        testLeaderboard, // Expose test function
    };
}
