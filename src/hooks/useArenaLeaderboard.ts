import { useState, useEffect, useCallback } from 'react';
import { gql } from '@apollo/client/core';
import { arenaClient } from '../contexts/ArenaGraphQLProvider';

export interface ArenaLeaderboardEntry {
    chainId: string;
    name: string;
    chips: number;
    handsWon: number;
    handsPlayed: number;
    biggestPot: number;
    rank: number;
}

// GraphQL query for Arena leaderboard (camelCase field names from async-graphql SimpleObject)
const GET_LEADERBOARD = gql`
    query GetLeaderboard($limit: Int!) {
        leaderboard(limit: $limit) {
            chainId
            name
            chips
            handsWon
            handsPlayed
            biggestPot
        }
    }
`;

// Note: Arena service doesn't have submitStats mutation - stats are submitted via cross-chain message
// from poker-contract. This hook is read-only for the leaderboard.

export function useArenaLeaderboard() {
    const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch leaderboard from Arena
    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data } = await arenaClient.query({
                query: GET_LEADERBOARD,
                variables: { limit: 10 },
                fetchPolicy: 'network-only',
            });

            if (data?.leaderboard) {
                const entries: ArenaLeaderboardEntry[] = data.leaderboard.map(
                    (entry: any, idx: number) => ({
                        chainId: entry.chainId,
                        name: entry.name,
                        chips: parseInt(entry.chips) || 0,
                        handsWon: parseInt(entry.handsWon) || 0,
                        handsPlayed: parseInt(entry.handsPlayed) || 0,
                        biggestPot: parseInt(entry.biggestPot) || 0,
                        rank: idx + 1,
                    })
                );
                console.log('[Arena] Leaderboard fetched:', entries.length, 'entries');
                setLeaderboard(entries);
            }
        } catch (err) {
            console.error('[Arena] Failed to fetch leaderboard:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-refresh leaderboard
    useEffect(() => {
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 10000); // Every 10 seconds
        return () => clearInterval(interval);
    }, [fetchLeaderboard]);

    return {
        leaderboard,
        isLoading,
        error,
        refetch: fetchLeaderboard,
    };
}
