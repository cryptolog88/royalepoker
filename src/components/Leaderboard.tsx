import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Medal, RefreshCw, ChevronDown, X, Globe } from 'lucide-react';
import { useArenaLeaderboard } from '../hooks/useArenaLeaderboard';

export const Leaderboard: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { leaderboard, isLoading, error, refetch } = useArenaLeaderboard();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

    // Calculate dropdown position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Trophy size={16} className="text-amber-400" />;
        if (rank === 2) return <Medal size={16} className="text-slate-300" />;
        if (rank === 3) return <Medal size={16} className="text-amber-600" />;
        return <span className="text-slate-500 text-xs font-mono">#{rank}</span>;
    };

    const getRankBg = (rank: number) => {
        if (rank === 1) return 'bg-amber-500/20 border-amber-500/50';
        if (rank === 2) return 'bg-slate-400/20 border-slate-400/50';
        if (rank === 3) return 'bg-amber-700/20 border-amber-700/50';
        return 'bg-slate-800/50 border-slate-700';
    };

    // Dropdown content to be portaled
    const dropdownContent = isOpen ? (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99999,
                    background: 'transparent',
                }}
                onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <div
                style={{
                    position: 'fixed',
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                    width: '320px',
                    zIndex: 100000,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '12px',
                    borderBottom: '1px solid #334155',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Trophy size={16} className="text-amber-400" />
                        <h3 style={{ fontWeight: 'bold', fontSize: '14px', color: 'white', margin: 0 }}>Leaderboard</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => refetch()}
                            disabled={isLoading}
                            style={{
                                padding: '6px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            <RefreshCw size={14} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                padding: '6px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Leaderboard List - Scrollable */}
                <div
                    style={{
                        padding: '8px',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                    }}
                >
                    {error ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#f87171', fontSize: '14px' }}>
                            <p>Failed to load</p>
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{error}</p>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '14px' }}>
                            {isLoading ? 'Loading...' : 'No players yet'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {leaderboard.map((player) => (
                                <div
                                    key={player.name}
                                    className={`flex items-center gap-3 p-2 rounded-lg border ${getRankBg(player.rank)}`}
                                >
                                    <div className="w-6 flex justify-center">
                                        {getRankIcon(player.rank)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">
                                            {player.name}
                                        </p>
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                            <span>🏆 {player.handsWon}</span>
                                            <span>•</span>
                                            <span>🎮 {player.handsPlayed}</span>
                                            {player.chainId && (
                                                <>
                                                    <span>•</span>
                                                    <span title={player.chainId} className="font-mono cursor-help text-emerald-400">
                                                        🔗 {player.chainId.slice(0, 6)}...{player.chainId.slice(-4)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-amber-400 font-mono">
                                            ${player.chips.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '8px',
                    borderTop: '1px solid #334155',
                    background: 'rgba(15, 23, 42, 0.3)',
                    borderRadius: '0 0 12px 12px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        color: '#64748b',
                    }}>
                        <Globe size={10} />
                        <span>Global Leaderboard • Poker Arena</span>
                    </div>
                </div>
            </div>
        </>
    ) : null;

    return (
        <>
            {/* Toggle Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 
                           rounded-full border border-amber-500/50 transition-all"
            >
                <Trophy size={14} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">Leaderboard</span>
                <ChevronDown
                    size={14}
                    className={`text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Portal dropdown to body to escape stacking context */}
            {createPortal(dropdownContent, document.body)}
        </>
    );
};
