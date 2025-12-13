import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card as CardType, Player, GamePhase, Room } from '../types';
import PlayingCard from '../components/PlayingCard';
import { Chips } from '../components/Chips';
import { LineraStatus } from './components/LineraStatus';
import { WalletSetup } from './components/WalletSetup';
import { useLinera } from './contexts/LineraContext';
import {
    RefreshCw, Clock, LogOut, Users, Menu, X, HelpCircle,
    Volume2, VolumeX, Trophy, Crown, Skull, ArrowRight, User,
    Copy, Check, ChevronDown, Wallet
} from 'lucide-react';
import { usePokerGame } from './hooks/usePokerGame';
import { useSound, SoundType } from './hooks/useSound';
import { Leaderboard } from './components/Leaderboard';
import { WalletDropdown } from './components/WalletDropdown';

const TABLE_ID = 'main-table-1';

const AVAILABLE_ROOMS: Room[] = [
    { id: 'room-1', name: 'Rookie Lounge', playersCount: 0, maxPlayers: 4, smallBlind: 10, bigBlind: 20, minBuyIn: 1000, difficulty: 'Rookie', themeColor: 'from-blue-600 to-blue-900' },
    { id: 'room-2', name: 'Vegas Strip', playersCount: 0, maxPlayers: 4, smallBlind: 50, bigBlind: 100, minBuyIn: 5000, difficulty: 'Pro', themeColor: 'from-emerald-600 to-emerald-900' },
    { id: 'room-3', name: 'Macau High Roller', playersCount: 0, maxPlayers: 4, smallBlind: 200, bigBlind: 400, minBuyIn: 20000, difficulty: 'Elite', themeColor: 'from-rose-600 to-rose-900' },
    { id: 'room-4', name: 'Royale VIP', playersCount: 0, maxPlayers: 4, smallBlind: 500, bigBlind: 1000, minBuyIn: 50000, difficulty: 'Legend', themeColor: 'from-amber-600 to-amber-900' },
];

// WebSocket URL for room counts
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const AppLinera: React.FC = () => {
    const { walletExists, status: walletStatus, chainId, owner } = useLinera();

    // ALL useState hooks must be at the top, before any conditional returns
    const [playerName, setPlayerName] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const [activeRoom, setActiveRoom] = useState<Room | null>(null);
    const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
    const lobbyWsRef = useRef<WebSocket | null>(null);

    // Load saved username for this chain ID from localStorage
    useEffect(() => {
        if (chainId) {
            const savedUsername = localStorage.getItem(`poker_username_${chainId}`);
            if (savedUsername) {
                setPlayerName(savedUsername);
            }
        }
    }, [chainId]);

    // Listen for room counts from usePokerGame WebSocket (when inside a room)
    useEffect(() => {
        const handleRoomCounts = (event: Event) => {
            const customEvent = event as CustomEvent;
            console.log('[Lobby] Room counts from game WS:', customEvent.detail);
            setRoomCounts(customEvent.detail || {});
        };

        window.addEventListener('room-counts-update', handleRoomCounts);
        return () => {
            window.removeEventListener('room-counts-update', handleRoomCounts);
        };
    }, []);

    // Connect to WebSocket for room counts - only when in lobby (not in a room)
    useEffect(() => {
        // Skip if already in a room - usePokerGame will handle ROOM_COUNTS
        if (activeRoom) return;

        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;
        let isUnmounted = false;

        const connectLobbyWs = () => {
            if (isUnmounted) return;

            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('[Lobby] WebSocket connected');
                // Request room counts
                ws?.send(JSON.stringify({ type: 'GET_ROOM_COUNTS' }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'ROOM_COUNTS') {
                        console.log('[Lobby] Room counts received:', message.counts);
                        setRoomCounts(message.counts || {});
                    }
                } catch (err) {
                    // Silent error
                }
            };

            ws.onclose = () => {
                console.log('[Lobby] WebSocket disconnected');
                if (!isUnmounted) {
                    // Reconnect after 3 seconds
                    reconnectTimeout = setTimeout(connectLobbyWs, 3000);
                }
            };

            ws.onerror = () => {
                // Silent error
            };

            lobbyWsRef.current = ws;
        };

        connectLobbyWs();

        return () => {
            isUnmounted = true;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (ws) {
                ws.close();
            }
            lobbyWsRef.current = null;
        };
    }, [activeRoom]); // Reconnect when leaving room

    // Use activeRoom.id if selected, otherwise use default TABLE_ID
    const currentTableId = activeRoom?.id || TABLE_ID;

    const {
        gameState,
        isLoading,
        error,
        createTable,
        joinTable,
        startGame,
        performAction,
        leaveTable,
        resetRoom,
    } = usePokerGame(currentTableId);
    const [localPlayers, setLocalPlayers] = useState<Player[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showHandRankings, setShowHandRankings] = useState(false);
    const [soundMuted, setSoundMuted] = useState(false);
    const { playSound } = useSound(soundMuted);
    const [raiseAmount, setRaiseAmount] = useState(100);
    const [timeLeft, setTimeLeft] = useState(20);
    const [myCards, setMyCards] = useState<CardType[]>([]);
    const [dealerIdx, setDealerIdx] = useState(0);
    const [showWalletDropdown, setShowWalletDropdown] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [lastWinnerAnnounced, setLastWinnerAnnounced] = useState<string | null>(null);

    // Ref to hold the latest handleAction function (avoids stale closure in timer)
    const handleActionRef = useRef<(action: string, amount?: number) => Promise<void>>();

    // Copy to clipboard helper
    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            // Silent error
        }
    };

    // ALL useEffect hooks must also be before conditional returns
    useEffect(() => {
        if (gameState && gameState.players) {
            // Reorder players so current player (by playerName) is always first (bottom seat)
            const allPlayers = gameState.players.map((p, idx) => ({
                id: idx,
                name: p.name || `Player ${idx + 1}`,
                chips: p.chips || 1000,
                hand: [],
                isBot: false,
                status: p.status || 'active',
                currentBet: p.currentBet || 0,
                avatarUrl: `https://picsum.photos/id/${100 + idx}/100/100`,
            }));

            // Find current player's index
            const myIndex = allPlayers.findIndex(p => p.name === playerName);

            if (myIndex > 0) {
                // Rotate array so current player is first
                const reordered = [
                    ...allPlayers.slice(myIndex),
                    ...allPlayers.slice(0, myIndex)
                ];
                setLocalPlayers(reordered);
            } else {
                setLocalPlayers(allPlayers);
            }
        }
    }, [gameState, playerName]);

    // Timer countdown - reset when phase changes or current player changes
    useEffect(() => {
        // Only run timer when game is active (not waiting) and player has joined
        // PreFlop is an active phase even without community cards
        if (!gameState || gameState.phase === 'Waiting' || !hasJoined) {
            setTimeLeft(20);
            return;
        }

        // Check if it's this player's turn
        const activePlayers = gameState.players.filter(p => p.status === 'Active' || p.status === 'AllIn');
        const currentPlayerIdx = gameState.currentPlayerIndex % activePlayers.length;
        const currentPlayer = activePlayers[currentPlayerIdx];
        const isMyTurn = currentPlayer?.name === playerName;

        // Reset timer to 20 seconds
        setTimeLeft(20);

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Time's up - auto fold only if it's my turn
                    if (isMyTurn && handleActionRef.current) {
                        handleActionRef.current('fold');
                    }
                    return 20;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState?.phase, gameState?.currentPlayerIndex, gameState?.players, playerName, hasJoined]);

    // Reset cards when waiting for new game or game over
    useEffect(() => {
        if (gameState?.phase === 'Waiting' || gameState?.phase === 'ReadyForNextHand' || gameState?.phase === 'GameOver') {
            setMyCards([]);
        }
    }, [gameState?.phase]);

    // Get player's cards from pre-dealt deck (deterministic across all clients)
    useEffect(() => {
        if (gameState?.phase === 'PreFlop' && playerName && gameState?.dealtCards?.playerCards) {
            // Find my index in the players array
            const myIndex = gameState.players.findIndex(p => p.name === playerName);

            if (myIndex >= 0 && gameState.dealtCards.playerCards[myIndex]) {
                const myDealtCards = gameState.dealtCards.playerCards[myIndex];
                const formattedCards: CardType[] = myDealtCards.map(card => ({
                    rank: card.rank as any,
                    suit: card.suit as 'hearts' | 'diamonds' | 'clubs' | 'spades',
                    value: card.value,
                    isHidden: false
                }));
                setMyCards(formattedCards);
            }
        }
    }, [gameState?.phase, gameState?.dealtCards, gameState?.handNumber, gameState?.players, playerName]);

    // Play win sound when winner is announced (only once per winner)
    useEffect(() => {
        if (gameState?.phase === 'Winner' && gameState?.winner) {
            const winnerKey = `${gameState.winner.name}-${gameState.handNumber || 0}`;
            if (lastWinnerAnnounced !== winnerKey) {
                playSound('win');
                setLastWinnerAnnounced(winnerKey);
            }
        }
    }, [gameState?.phase, gameState?.winner, gameState?.handNumber, playSound, lastWinnerAnnounced]);

    // IMPORTANT: ALL useCallback hooks MUST be before any conditional returns (React Rules of Hooks)
    const handleAction = useCallback(async (action: string, amount?: number) => {
        // Play sound effect for the action
        const soundMap: Record<string, SoundType> = {
            fold: 'fold',
            check: 'check',
            call: 'call',
            raise: 'raise',
        };
        if (soundMap[action]) {
            playSound(soundMap[action]);
        }

        const actionObj = action === 'raise'
            ? { Raise: { amount: amount || 0 } }
            : action === 'fold' ? 'Fold'
                : action === 'check' ? 'Check'
                    : action === 'call' ? 'Call'
                        : 'AllIn';

        // Pass playerName so the action is associated with the correct player
        await performAction(actionObj, playerName);
    }, [performAction, playerName, playSound]);

    // Keep ref updated with latest handleAction
    useEffect(() => {
        handleActionRef.current = handleAction;
    }, [handleAction]);

    // leaveRoom must be defined before conditional returns (React Rules of Hooks)
    const leaveRoom = useCallback(async () => {
        // Call leaveTable to properly cleanup on blockchain and WebSocket
        if (playerName && leaveTable) {
            try {
                await leaveTable(playerName);
            } catch (err) {
                // Silent error - continue with local cleanup
            }
        }

        // Reset all local state
        setActiveRoom(null);
        setHasJoined(false);
        setIsMenuOpen(false);
        setMyCards([]);
        setLastWinnerAnnounced(null);
        setLocalPlayers([]);
    }, [playerName, leaveTable]);

    // Show wallet setup if wallet doesn't exist or not ready
    // This MUST be after all hooks (useState, useEffect, useCallback) to follow React Rules of Hooks

    // Show loading state while initializing
    if (walletStatus === 'Initializing' || walletStatus === 'Connecting' || walletStatus === 'Claiming Chain' || walletStatus === 'Creating Wallet') {
        return <WalletSetup />;
    }

    // Show wallet setup if wallet doesn't exist
    if (!walletExists || walletStatus === 'Idle' || walletStatus === 'Error') {
        return <WalletSetup />;
    }

    // At this point, wallet should be ready
    if (walletStatus !== 'Ready') {
        return <WalletSetup />;
    }

    const handleJoinRoom = async (room: Room) => {
        setActiveRoom(room);
        if (!createTable) return;
        await createTable(room.id, room.smallBlind, room.bigBlind, room.minBuyIn);
    };

    const handleJoinTable = async () => {
        if (!playerName.trim()) return;
        // Use room's minBuyIn for starting chips
        const buyIn = activeRoom?.minBuyIn || 1000;
        const success = await joinTable(playerName, buyIn);
        if (success) {
            setHasJoined(true);
            // Save username associated with this chain ID
            if (chainId) {
                localStorage.setItem(`poker_username_${chainId}`, playerName.trim());
            }
        }
    };

    // LOBBY VIEW - Show room selection first
    if (!activeRoom) {
        return (
            <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col font-sans relative overflow-y-auto">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 z-0 pointer-events-none"></div>

                <header className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg flex items-center justify-center transform rotate-3">
                            <span className="font-serif font-bold text-slate-900 text-2xl">R</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-serif font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">ROYALE POKER</h1>
                            <p className="text-xs text-slate-400 tracking-widest uppercase">Blockchain Edition</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Leaderboard */}
                        <Leaderboard />

                        {/* Wallet Dropdown */}
                        <WalletDropdown
                            owner={owner}
                            chainId={chainId}
                            isOpen={showWalletDropdown}
                            setIsOpen={setShowWalletDropdown}
                            copyToClipboard={copyToClipboard}
                            copiedField={copiedField}
                        />
                    </div>
                </header>

                <main className="relative z-10 flex-1 p-6 flex items-center justify-center">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
                        {AVAILABLE_ROOMS.map(room => (
                            <div key={room.id} className="group relative bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-white/5 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                <div className={`absolute inset-0 h-32 bg-gradient-to-b ${room.themeColor} opacity-20 group-hover:opacity-30 transition-opacity`}></div>

                                <div className="relative p-6 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 border border-white/10 ${room.difficulty === 'Rookie' ? 'text-blue-300' :
                                            room.difficulty === 'Pro' ? 'text-emerald-300' :
                                                room.difficulty === 'Elite' ? 'text-rose-300' : 'text-amber-300'
                                            }`}>
                                            {room.difficulty}
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs ${(roomCounts[room.id] || 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                            <Users size={14} />
                                            <span className="font-bold">{roomCounts[room.id] || 0}/{room.maxPlayers}</span>
                                        </div>
                                    </div>

                                    <h2 className="text-2xl font-serif font-bold text-white mb-1">{room.name}</h2>
                                    <p className="text-slate-400 text-sm mb-6">Blinds: ${room.smallBlind}/${room.bigBlind}</p>

                                    <div className="flex-1 flex flex-col justify-end gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500">Min Buy-in</span>
                                                <span className="text-slate-200 font-mono">${room.minBuyIn.toLocaleString()}</span>
                                            </div>
                                            <div className="h-px bg-white/10"></div>
                                        </div>

                                        <button
                                            onClick={() => handleJoinRoom(room)}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 group-hover:bg-amber-500 group-hover:text-slate-900 group-hover:border-amber-500 transition-all font-bold"
                                        >
                                            <span>Join Table</span>
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    // JOIN SCREEN - Only show after room is selected
    if (activeRoom && !hasJoined) {
        return (
            <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 z-0"></div>

                <div className="relative z-10 bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-md w-full shadow-2xl">
                    <button
                        onClick={() => setActiveRoom(null)}
                        className="absolute top-4 left-4 text-slate-400 hover:text-white"
                    >
                        ← Back
                    </button>

                    <div className="text-center mb-6">
                        <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase mb-2 bg-gradient-to-r ${activeRoom.themeColor}`}>
                            {activeRoom.difficulty}
                        </div>
                        <h1 className="text-3xl font-serif font-bold text-amber-500 mb-2">
                            {activeRoom.name}
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Blinds: ${activeRoom.smallBlind}/${activeRoom.bigBlind} • Buy-in: ${activeRoom.minBuyIn}
                        </p>
                    </div>

                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white mb-4 focus:border-amber-500 focus:outline-none"
                        onKeyPress={(e) => e.key === 'Enter' && handleJoinTable()}
                    />

                    <button
                        onClick={handleJoinTable}
                        disabled={isLoading || !playerName.trim()}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isLoading ? 'Joining...' : 'Join Table'}
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-rose-900/20 border border-rose-500/50 rounded-lg">
                            <p className="text-rose-400 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <div className="flex items-center justify-between text-sm text-slate-400">
                            <span>Players in room:</span>
                            <span className="text-emerald-400 font-bold">{gameState?.players.length || 0}/{activeRoom.maxPlayers}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // GAME VIEW
    return (
        <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col overflow-hidden relative font-sans">
            <div className="absolute inset-0 bg-radial-gradient from-emerald-900/40 to-slate-900 z-0 pointer-events-none"></div>

            <header className="relative z-10 w-full p-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center transform rotate-3">
                        <span className="font-serif font-bold text-slate-900 text-lg">R</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-serif font-bold tracking-wide text-amber-500 hidden sm:block leading-none">ROYALE POKER</h1>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">{activeRoom?.name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6">
                    {/* Linera Status Dropdown */}
                    <LineraStatus
                        chainId={chainId}
                        appId={import.meta.env.VITE_LINERA_APP_ID}
                        owner={owner}
                        network="testnet-conway"
                    />

                    {/* Blinds Info */}
                    <div className="hidden sm:flex items-center gap-1 text-xs sm:text-sm text-slate-400">
                        <Trophy size={14} className="text-amber-400" />
                        <span>Blinds: ${activeRoom?.smallBlind}/${activeRoom?.bigBlind}</span>
                    </div>

                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Menu size={24} className="text-slate-200" />
                    </button>
                </div>
            </header>

            <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-4 pb-32">
                <div className="relative w-full max-w-4xl aspect-[1.8] bg-[#0c3e2b] rounded-[150px] border-[12px] border-[#3f2e18] shadow-2xl flex items-center justify-center felt-texture ring-1 ring-white/10">

                    {/* Pot Display - Above community cards */}
                    <div className="absolute top-[25%] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 z-40">
                        {/* Pot Amount Badge */}
                        <div className="bg-black/50 backdrop-blur-sm px-8 py-3 rounded-2xl border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex flex-col items-center">
                            <span className="text-[10px] text-emerald-300 uppercase tracking-widest font-semibold mb-1">Total Pot</span>
                            <span className="text-amber-400 font-serif text-3xl font-bold drop-shadow-lg">${gameState?.pot || 0}</span>
                        </div>

                        {/* Chip Stack Visualization - More visible */}
                        {(gameState?.pot || 0) > 0 && (
                            <div className="flex items-end gap-2 animate-[fade-in_0.3s_ease-out]">
                                {(() => {
                                    const pot = gameState?.pot || 0;
                                    const chips: { color: string; border: string; count: number; value: number }[] = [];
                                    let remaining = pot;

                                    // Gold chips (1000)
                                    if (remaining >= 1000) {
                                        const count = Math.min(Math.floor(remaining / 1000), 5);
                                        chips.push({ color: 'bg-gradient-to-b from-yellow-300 to-yellow-600', border: 'border-yellow-200', count, value: 1000 });
                                        remaining -= count * 1000;
                                    }
                                    // Purple chips (500)
                                    if (remaining >= 500) {
                                        const count = Math.min(Math.floor(remaining / 500), 3);
                                        chips.push({ color: 'bg-gradient-to-b from-purple-400 to-purple-700', border: 'border-purple-300', count, value: 500 });
                                        remaining -= count * 500;
                                    }
                                    // Black chips (100)
                                    if (remaining >= 100) {
                                        const count = Math.min(Math.floor(remaining / 100), 5);
                                        chips.push({ color: 'bg-gradient-to-b from-gray-600 to-gray-900', border: 'border-gray-400', count, value: 100 });
                                        remaining -= count * 100;
                                    }
                                    // Green chips (25)
                                    if (remaining >= 25) {
                                        const count = Math.min(Math.floor(remaining / 25), 4);
                                        chips.push({ color: 'bg-gradient-to-b from-green-400 to-green-700', border: 'border-green-300', count, value: 25 });
                                        remaining -= count * 25;
                                    }
                                    // Red chips (5)
                                    if (remaining >= 5) {
                                        const count = Math.min(Math.floor(remaining / 5), 4);
                                        chips.push({ color: 'bg-gradient-to-b from-red-400 to-red-700', border: 'border-red-300', count, value: 5 });
                                    }
                                    // White chips (1)
                                    if (remaining >= 1) {
                                        const count = Math.min(remaining, 5);
                                        chips.push({ color: 'bg-gradient-to-b from-white to-gray-300', border: 'border-gray-200', count, value: 1 });
                                    }

                                    return chips.map((stack, stackIdx) => (
                                        <div key={stackIdx} className="flex flex-col-reverse items-center relative group">
                                            {Array.from({ length: stack.count }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-8 h-3 ${stack.color} rounded-full border-2 ${stack.border} shadow-md`}
                                                    style={{
                                                        marginTop: i > 0 ? '-6px' : '0',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
                                                    }}
                                                />
                                            ))}
                                            {/* Chip value tooltip */}
                                            <div className="absolute -bottom-5 text-[8px] text-white/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                                ${stack.value}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex gap-2">
                        {/* Debug: show phase and card count */}
                        {gameState && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-white/50">
                                Phase: {gameState.phase} | Cards: {gameState.communityCards?.length || 0}
                            </div>
                        )}
                        {gameState?.communityCards && gameState.communityCards.length > 0 ? (
                            gameState.communityCards.map((card, i) => (
                                <PlayingCard
                                    key={i}
                                    card={{
                                        rank: card.rank as any,
                                        suit: card.suit as any,
                                        value: 0,
                                        isHidden: false,
                                    }}
                                    className="animate-[fade-in-up_0.5s_ease-out]"
                                />
                            ))
                        ) : (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={`empty-${i}`} className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-white/5 bg-white/5"></div>
                            ))
                        )}
                    </div>

                    {/* Other players - only show if they exist */}
                    {localPlayers.length > 1 && localPlayers[1] && (
                        <PlayerSeat player={localPlayers[1]} position="top" isDealer={dealerIdx === 1} />
                    )}
                    {localPlayers.length > 2 && localPlayers[2] && (
                        <PlayerSeat player={localPlayers[2]} position="left" isDealer={dealerIdx === 2} />
                    )}
                    {localPlayers.length > 3 && localPlayers[3] && (
                        <PlayerSeat player={localPlayers[3]} position="right" isDealer={dealerIdx === 3} />
                    )}

                    {/* Current player (You) - always at bottom */}
                    {localPlayers.length > 0 && (
                        <div className="absolute bottom-[-40px] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-4 z-30 w-full max-w-lg">
                            {/* Your Bet Bubble - shows above your seat when you have a bet */}
                            {(localPlayers[0]?.currentBet || 0) > 0 && (
                                <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-[fade-in_0.3s_ease-out] z-40">
                                    {/* Chip stack for your bet */}
                                    <div className="flex items-end gap-1 mb-1">
                                        {(() => {
                                            const bet = localPlayers[0]?.currentBet || 0;
                                            const chips: { color: string; border: string; count: number }[] = [];
                                            let remaining = bet;

                                            if (remaining >= 100) {
                                                const count = Math.min(Math.floor(remaining / 100), 3);
                                                chips.push({ color: 'bg-gradient-to-b from-gray-600 to-gray-900', border: 'border-gray-400', count });
                                                remaining -= count * 100;
                                            }
                                            if (remaining >= 25) {
                                                const count = Math.min(Math.floor(remaining / 25), 3);
                                                chips.push({ color: 'bg-gradient-to-b from-green-400 to-green-700', border: 'border-green-300', count });
                                                remaining -= count * 25;
                                            }
                                            if (remaining >= 5) {
                                                const count = Math.min(Math.floor(remaining / 5), 3);
                                                chips.push({ color: 'bg-gradient-to-b from-red-400 to-red-700', border: 'border-red-300', count });
                                            }

                                            return chips.map((stack, stackIdx) => (
                                                <div key={stackIdx} className="flex flex-col-reverse items-center">
                                                    {Array.from({ length: stack.count }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-6 h-2 ${stack.color} rounded-full border ${stack.border} shadow-sm`}
                                                            style={{ marginTop: i > 0 ? '-4px' : '0' }}
                                                        />
                                                    ))}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                    {/* Bet amount badge */}
                                    <div className="bg-slate-900/90 px-3 py-1 rounded-full border border-amber-500/50 flex items-center gap-1.5 shadow-lg">
                                        <div className="w-3 h-3 bg-amber-500 rounded-full shadow-inner"></div>
                                        <span className="text-sm font-bold text-white">${localPlayers[0]?.currentBet}</span>
                                    </div>
                                </div>
                            )}

                            <div className="relative bg-slate-800 border-2 border-amber-400 ring-4 ring-amber-400/20 rounded-2xl p-4 flex items-center gap-4 min-w-[300px] shadow-2xl">
                                <div className="relative">
                                    <img src={localPlayers[0]?.avatarUrl} className="w-12 h-12 rounded-full border-2 border-slate-500" alt="You" />
                                    {dealerIdx === 0 && <div className="absolute -top-2 -right-2 w-5 h-5 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold text-[10px] border border-slate-300 shadow-sm">D</div>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-white">{playerName || localPlayers[0]?.name || 'You'}</span>
                                        <Chips amount={localPlayers[0]?.chips || 1000} />
                                    </div>
                                    <div className="h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 w-full"></div>
                                    </div>
                                </div>

                                {myCards.length > 0 && localPlayers[0]?.status !== 'Folded' && (
                                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 flex gap-1">
                                        {myCards.map((card, i) => (
                                            <PlayingCard
                                                key={i}
                                                card={card}
                                                style={{ transform: `rotate(${(i - 0.5) * 6}deg)` }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Winner Celebration Overlay */}
                    {gameState?.phase === 'Winner' && gameState?.winner && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-[150px] overflow-y-auto py-8">
                            <div className="relative">
                                {/* Confetti effect */}
                                <div className="absolute -top-20 left-1/2 -translate-x-1/2 text-8xl animate-bounce">
                                    🏆
                                </div>

                                {/* Winner card */}
                                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(245,158,11,0.3)]">
                                    <p className="text-amber-400 text-sm uppercase tracking-widest mb-2 font-semibold">
                                        {gameState.winner.reason === 'fold' ? 'Winner by Fold' : 'Showdown Winner'}
                                    </p>
                                    <h2 className="text-4xl font-serif font-bold text-white mb-2">
                                        {gameState.winner.name}
                                    </h2>
                                    {/* Show winning hand rank for showdown */}
                                    {gameState.winner.reason === 'showdown' && gameState.winner.handRank && (
                                        <p className="text-xl text-amber-300 font-semibold mb-2">
                                            {gameState.winner.handRank}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <span className="text-2xl">💰</span>
                                        <span className="text-3xl font-bold text-emerald-400 font-mono">
                                            +${gameState.winner.amount.toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-sm">
                                        New hand starting in 5 seconds...
                                    </p>
                                </div>
                            </div>

                            {/* Show player cards at showdown (only when reason is 'showdown') */}
                            {gameState.winner.reason === 'showdown' && gameState.showdownCards && gameState.showdownCards.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-center text-slate-400 text-sm mb-3 uppercase tracking-wider">Showdown Cards</p>
                                    <div className="flex gap-6 justify-center flex-wrap">
                                        {gameState.showdownCards.map((sc, i) => (
                                            <div
                                                key={i}
                                                className={`p-4 rounded-xl border ${sc.playerName === gameState.winner?.name
                                                    ? 'bg-amber-500/20 border-amber-500'
                                                    : 'bg-slate-800/50 border-slate-700'
                                                    }`}
                                            >
                                                <p className={`text-sm font-semibold mb-2 text-center ${sc.playerName === gameState.winner?.name ? 'text-amber-400' : 'text-white'
                                                    }`}>
                                                    {sc.playerName}
                                                </p>
                                                {/* Player's hole cards */}
                                                <div className="flex gap-1 justify-center mb-2">
                                                    {sc.cards.map((card, ci) => (
                                                        <PlayingCard key={ci} card={card} size="small" />
                                                    ))}
                                                </div>
                                                <p className={`text-xs text-center font-medium ${sc.playerName === gameState.winner?.name ? 'text-amber-300' : 'text-slate-400'
                                                    }`}>
                                                    {sc.handRank}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Show final chips for all players */}
                            <div className="mt-6 flex gap-4">
                                {gameState.players.map((p, i) => (
                                    <div
                                        key={i}
                                        className={`px-4 py-2 rounded-xl border ${p.name === gameState.winner?.name
                                            ? 'bg-amber-500/20 border-amber-500'
                                            : 'bg-slate-800/50 border-slate-700'
                                            }`}
                                    >
                                        <p className="text-sm font-semibold text-white">{p.name}</p>
                                        <p className={`text-lg font-mono font-bold ${p.name === gameState.winner?.name ? 'text-amber-400' : 'text-slate-400'
                                            }`}>
                                            ${p.chips.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ready for Next Hand - Players still have chips */}
                    {gameState?.phase === 'ReadyForNextHand' && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-[150px]">
                            <h2 className="text-3xl font-serif text-amber-500 mb-2 font-bold tracking-widest">NEXT HAND</h2>
                            <p className="text-slate-300 mb-4 font-mono">Ready to continue playing</p>

                            {/* Show player chips */}
                            <div className="mb-6 flex gap-4">
                                {gameState.players.filter(p => p.chips > 0).map((p, i) => (
                                    <div key={i} className="px-4 py-2 rounded-xl border bg-slate-800/50 border-slate-700">
                                        <p className="text-sm font-semibold text-white">{p.name}</p>
                                        <p className="text-lg font-mono font-bold text-emerald-400">
                                            ${p.chips.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={startGame}
                                    disabled={isLoading}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold font-serif text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] transform transition hover:scale-105 active:scale-95 disabled:opacity-50"
                                >
                                    Deal Next Hand
                                </button>
                                <button
                                    onClick={leaveRoom}
                                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-4 rounded-full transition"
                                >
                                    Leave Table
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Game Over - Only one player has chips */}
                    {gameState?.phase === 'GameOver' && gameState?.winner && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-[150px]">
                            <div className="text-8xl mb-4">👑</div>
                            <h2 className="text-4xl font-serif text-amber-500 mb-2 font-bold tracking-widest">GAME OVER</h2>
                            <p className="text-2xl text-white font-bold mb-2">{gameState.winner.name} Wins!</p>
                            <p className="text-emerald-400 text-xl font-mono mb-6">
                                Total: ${gameState.players.find(p => p.name === gameState.winner?.name)?.chips.toLocaleString() || 0}
                            </p>
                            <p className="text-slate-400 text-sm">Returning to lobby in 5 seconds...</p>
                        </div>
                    )}

                    {/* Waiting screen - ONLY when phase is Waiting (not during PreFlop/active play) */}
                    {gameState?.phase === 'Waiting' && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-[150px]">
                            <h2 className="text-3xl font-serif text-amber-500 mb-2 font-bold tracking-widest">{activeRoom?.name?.toUpperCase() || 'POKER TABLE'}</h2>
                            <p className="text-slate-300 mb-2 font-mono">Buy-in: ${activeRoom?.minBuyIn || 1000}</p>

                            {/* Player count info */}
                            <div className="mb-4 px-6 py-3 bg-slate-800/80 rounded-xl border border-slate-600">
                                <p className="text-center text-slate-300">
                                    <span className="text-emerald-400 font-bold text-2xl">{gameState?.players.length || 0}</span>
                                    <span className="text-slate-400"> / {activeRoom?.maxPlayers} players</span>
                                </p>
                                {(gameState?.players.length || 0) < 2 && (
                                    <p className="text-amber-400 text-sm mt-1 text-center">
                                        Need {2 - (gameState?.players.length || 0)} more player(s) to start
                                    </p>
                                )}
                                {/* Show player names */}
                                <div className="mt-2 text-xs text-slate-400">
                                    {gameState?.players.map((p, i) => (
                                        <span key={i} className="inline-block bg-slate-700 px-2 py-1 rounded mr-1 mb-1">
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={startGame}
                                    disabled={isLoading || (gameState?.players.length || 0) < 2}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold font-serif text-xl px-12 py-4 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] transform transition hover:scale-105 active:scale-95 disabled:opacity-50"
                                >
                                    {(gameState?.players.length || 0) < 2 ? 'Waiting for Players...' : 'Deal Cards'}
                                </button>

                                <button
                                    onClick={resetRoom}
                                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-4 rounded-full transition"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Menu Dropdown - Portal */}
            {createPortal(
                isMenuOpen ? (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                            onClick={() => setIsMenuOpen(false)}
                        />
                        <div
                            style={{
                                position: 'fixed',
                                top: '70px',
                                right: '16px',
                                width: '256px',
                                zIndex: 99999,
                                background: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '12px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                overflow: 'hidden',
                            }}
                        >
                            <div className="p-2 flex flex-col gap-1">
                                <button
                                    onClick={() => { setShowHandRankings(true); setIsMenuOpen(false); }}
                                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    <HelpCircle size={18} className="text-amber-400" />
                                    <span>Hand Rankings</span>
                                </button>
                                <button
                                    onClick={() => setSoundMuted(!soundMuted)}
                                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    {soundMuted ? <VolumeX size={18} className="text-rose-400" /> : <Volume2 size={18} className="text-emerald-400" />}
                                    <span>Sound: {soundMuted ? 'Off' : 'On'}</span>
                                </button>
                                <button
                                    onClick={() => { resetRoom(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-amber-300 hover:bg-amber-900/30 rounded-lg transition-colors"
                                >
                                    <RefreshCw size={18} />
                                    <span>Reset Room</span>
                                </button>
                                <div className="h-px bg-slate-700 my-1"></div>
                                <button
                                    onClick={leaveRoom}
                                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-rose-300 hover:bg-rose-900/30 rounded-lg transition-colors"
                                >
                                    <LogOut size={18} />
                                    <span>Leave Room</span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : null,
                document.body
            )}

            {/* Hand Rankings Modal - Portal */}
            {createPortal(
                showHandRankings ? (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 100000,
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                        }}
                        onClick={() => setShowHandRankings(false)}
                    >
                        <div
                            className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
                                <h3 className="text-xl font-serif font-bold text-amber-500">Poker Hand Rankings</h3>
                                <button onClick={() => setShowHandRankings(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                            </div>
                            <div className="p-4 overflow-y-auto space-y-2">
                                <HandRankRow rank="Royal Flush" desc="A, K, Q, J, 10, all the same suit." score="10" />
                                <HandRankRow rank="Straight Flush" desc="Five cards in a sequence, all in the same suit." score="9" />
                                <HandRankRow rank="Four of a Kind" desc="All four cards of the same rank." score="8" />
                                <HandRankRow rank="Full House" desc="Three of a kind with a pair." score="7" />
                                <HandRankRow rank="Flush" desc="Any five cards of the same suit, but not in a sequence." score="6" />
                                <HandRankRow rank="Straight" desc="Five cards in a sequence, but not of the same suit." score="5" />
                                <HandRankRow rank="Three of a Kind" desc="Three cards of the same rank." score="4" />
                                <HandRankRow rank="Two Pair" desc="Two different pairs." score="3" />
                                <HandRankRow rank="Pair" desc="Two cards of the same rank." score="2" />
                                <HandRankRow rank="High Card" desc="When you haven't made any of the hands above." score="1" />
                            </div>
                        </div>
                    </div>
                ) : null,
                document.body
            )}

            {gameState?.phase !== 'Waiting' && (() => {
                // Calculate whose turn it is
                const activePlayers = gameState?.players.filter(p => p.status === 'Active' || p.status === 'AllIn') || [];
                const currentPlayerIdx = (gameState?.currentPlayerIndex || 0) % Math.max(1, activePlayers.length);
                const currentPlayer = activePlayers[currentPlayerIdx];
                const isMyTurn = currentPlayer?.name === playerName;

                return (
                    <div className="fixed bottom-0 left-0 w-full z-50 bg-slate-900/95 border-t border-white/10 backdrop-blur-xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                        <div className="w-full h-1.5 bg-slate-800">
                            <div className={`h-full transition-all duration-1000 ease-linear ${isMyTurn ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${(timeLeft / 20) * 100}%` }}></div>
                        </div>

                        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="hidden md:flex items-center gap-3 text-slate-300 font-serif min-w-[180px]">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isMyTurn ? 'bg-emerald-900/50 border-emerald-700' : 'bg-slate-800 border-slate-700'}`}>
                                    <Clock size={16} className={isMyTurn ? 'text-emerald-400' : 'text-amber-400'} />
                                    <span className="font-mono font-bold text-lg">{timeLeft}s</span>
                                </div>
                                <span className={`text-sm italic ${isMyTurn ? 'text-emerald-400' : 'text-amber-400 opacity-70'}`}>
                                    {isMyTurn ? 'Your Turn!' : `${currentPlayer?.name || 'Waiting'}...`}
                                </span>
                            </div>

                            <div className="flex gap-2 w-full md:w-auto justify-center">
                                <ActionButton label="Fold" onClick={() => handleAction('fold')} variant="danger" disabled={!isMyTurn} />
                                <ActionButton label="Check" onClick={() => handleAction('check')} disabled={!isMyTurn} />
                                <ActionButton label="Call" onClick={() => handleAction('call')} variant="primary" subtext={`${gameState?.currentBet || 0}`} disabled={!isMyTurn} />
                            </div>

                            <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-xl border border-white/10 w-full md:w-auto justify-center">
                                <div className="flex flex-col gap-1 w-full md:w-[200px]">
                                    <div className="flex justify-between text-xs text-slate-400 font-bold px-1">
                                        <span>Min: ${(gameState?.currentBet || 0) + (activeRoom?.bigBlind || 20)}</span>
                                        <span>Max: $1000</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={(gameState?.currentBet || 0) + (activeRoom?.bigBlind || 20)}
                                        max={1000}
                                        value={raiseAmount}
                                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                                    />
                                    <div className="flex items-center justify-between bg-slate-900 rounded-lg border border-slate-700 px-2 py-1">
                                        <span className="text-amber-500 text-xs">$</span>
                                        <input
                                            type="number"
                                            min={(gameState?.currentBet || 0) + (activeRoom?.bigBlind || 20)}
                                            max={1000}
                                            value={raiseAmount}
                                            onChange={(e) => setRaiseAmount(Number(e.target.value))}
                                            className="bg-transparent text-right text-white font-mono text-sm w-full outline-none"
                                        />
                                    </div>
                                </div>
                                <ActionButton
                                    label="Raise"
                                    onClick={() => handleAction('raise', raiseAmount)}
                                    variant="warning"
                                    subtext={`to ${raiseAmount}`}
                                    disabled={!isMyTurn}
                                />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

const HandRankRow: React.FC<{ rank: string, desc: string, score: string }> = ({ rank, desc, score }) => (
    <div className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-colors">
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center font-bold text-amber-500 text-sm">{score}</div>
        <div>
            <div className="font-serif font-bold text-emerald-100">{rank}</div>
            <div className="text-xs text-slate-400">{desc}</div>
        </div>
    </div>
);

const PlayerSeat: React.FC<{ player: Player, position: 'top' | 'left' | 'right', isDealer?: boolean }> = ({ player, position, isDealer }) => {
    const getPositionClasses = () => {
        switch (position) {
            case 'top': return 'top-[-50px] left-1/2 transform -translate-x-1/2 flex-col-reverse';
            case 'left': return 'left-[-60px] top-1/2 transform -translate-y-1/2 flex-row';
            case 'right': return 'right-[-60px] top-1/2 transform -translate-y-1/2 flex-row-reverse';
        }
    };

    // Get bet bubble position based on player position
    const getBetBubblePosition = () => {
        switch (position) {
            case 'top': return '-bottom-12 left-1/2 -translate-x-1/2';
            case 'left': return 'top-1/2 -right-16 -translate-y-1/2';
            case 'right': return 'top-1/2 -left-16 -translate-y-1/2';
        }
    };

    // Hidden cards for other players (show card backs)
    const hiddenCard: CardType = {
        rank: '2',
        suit: 'hearts',
        value: 2,
        isHidden: true
    };

    // Generate chip stacks for bet visualization
    const renderBetChips = (bet: number) => {
        const chips: { color: string; border: string; count: number }[] = [];
        let remaining = bet;

        if (remaining >= 100) {
            const count = Math.min(Math.floor(remaining / 100), 3);
            chips.push({ color: 'bg-gradient-to-b from-gray-600 to-gray-900', border: 'border-gray-400', count });
            remaining -= count * 100;
        }
        if (remaining >= 25) {
            const count = Math.min(Math.floor(remaining / 25), 2);
            chips.push({ color: 'bg-gradient-to-b from-green-400 to-green-700', border: 'border-green-300', count });
            remaining -= count * 25;
        }
        if (remaining >= 5) {
            const count = Math.min(Math.floor(remaining / 5), 2);
            chips.push({ color: 'bg-gradient-to-b from-red-400 to-red-700', border: 'border-red-300', count });
        }

        return chips.map((stack, stackIdx) => (
            <div key={stackIdx} className="flex flex-col-reverse items-center">
                {Array.from({ length: stack.count }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-5 h-2 ${stack.color} rounded-full border ${stack.border} shadow-sm`}
                        style={{ marginTop: i > 0 ? '-3px' : '0' }}
                    />
                ))}
            </div>
        ));
    };

    // Normalize status to lowercase for comparison
    const normalizedStatus = player.status?.toLowerCase() || 'active';
    const isFolded = normalizedStatus === 'folded';

    return (
        <div className={`absolute ${getPositionClasses()} flex items-center gap-3 z-30 transition-all duration-300 ${isFolded ? 'opacity-40 grayscale' : ''}`}>
            {/* Hidden Cards - Show card backs for other players, hide if folded */}
            {!isFolded && (
                <div className="flex -space-x-4">
                    <PlayingCard card={hiddenCard} className="w-12 h-16 sm:w-14 sm:h-20 text-[10px]" />
                    <PlayingCard card={hiddenCard} className="w-12 h-16 sm:w-14 sm:h-20 text-[10px]" />
                </div>
            )}

            {/* Player Info */}
            <div className="relative bg-slate-800 p-2 rounded-xl border border-slate-600 min-w-[120px]">
                <div className="flex items-center gap-2 mb-1">
                    <div className="relative">
                        <img src={player.avatarUrl} className="w-8 h-8 rounded-full bg-slate-700" alt="Player" />
                        {isDealer && <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold text-[8px]">D</div>}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-white leading-none">{player.name}</div>
                        <div className="text-[10px] text-slate-400 leading-none mt-0.5">
                            {normalizedStatus === 'waiting' ? 'Ready' : isFolded ? 'Folded' : 'Active'}
                        </div>
                    </div>
                </div>
                <Chips amount={player.chips} className="justify-end" />

                {/* Bet Bubble with Chip Visualization */}
                {player.currentBet > 0 && (
                    <div className={`absolute ${getBetBubblePosition()} flex flex-col items-center animate-[fade-in_0.3s_ease-out]`}>
                        {/* Chip stack */}
                        <div className="flex items-end gap-0.5 mb-1">
                            {renderBetChips(player.currentBet)}
                        </div>
                        {/* Bet amount badge */}
                        <div className="bg-slate-900/90 px-2 py-1 rounded-full border border-amber-500/50 flex items-center gap-1 shadow-lg">
                            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-inner"></div>
                            <span className="text-xs font-bold text-white">${player.currentBet}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ActionButton: React.FC<{ label: string, onClick: () => void, variant?: 'primary' | 'secondary' | 'danger' | 'warning', disabled?: boolean, subtext?: string }> = ({ label, onClick, variant = 'secondary', disabled, subtext }) => {
    const baseStyles = "flex flex-col items-center justify-center px-4 py-3 rounded-xl font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-[70px] sm:min-w-[90px]";
    const variants = {
        primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50",
        secondary: "bg-slate-700 hover:bg-slate-600 text-white",
        danger: "bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-700",
        warning: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/50"
    };

    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]}`}>
            <span className="text-sm sm:text-base tracking-wide">{label}</span>
            {subtext && <span className="text-[10px] opacity-80 font-mono mt-0.5 whitespace-nowrap">{subtext}</span>}
        </button>
    );
};

export default AppLinera;
