import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Trophy, Clock } from 'lucide-react';

export interface HandRecord {
    id: string;
    handNumber: number;
    timestamp: number;
    players: {
        name: string;
        cards?: { rank: string; suit: string }[];
        finalChips: number;
        result: 'won' | 'lost' | 'folded';
    }[];
    communityCards: { rank: string; suit: string }[];
    pot: number;
    winner: {
        name: string;
        amount: number;
        handRank?: string;
        reason: 'fold' | 'showdown';
    };
    actions: {
        playerName: string;
        action: string;
        amount?: number;
        phase: string;
    }[];
}

interface HandHistoryProps {
    history: HandRecord[];
    isOpen: boolean;
    onClose: () => void;
    currentPlayerName: string;
}

const getSuitSymbol = (suit: string): string => {
    const symbols: Record<string, string> = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠',
    };
    return symbols[suit.toLowerCase()] || suit;
};

const getSuitColor = (suit: string): string => {
    return ['hearts', 'diamonds'].includes(suit.toLowerCase()) ? 'text-red-500' : 'text-white';
};

const MiniCard: React.FC<{ rank: string; suit: string }> = ({ rank, suit }) => (
    <span className={`inline-flex items-center ${getSuitColor(suit)} font-mono text-sm`}>
        {rank}{getSuitSymbol(suit)}
    </span>
);

export const HandHistory: React.FC<HandHistoryProps> = ({
    history,
    isOpen,
    onClose,
    currentPlayerName,
}) => {
    const [expandedHand, setExpandedHand] = useState<string | null>(null);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800/95 rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <Clock className="text-amber-400" size={20} />
                        <h2 className="text-xl font-bold text-white">Hand History</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {history.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="mx-auto text-slate-600 mb-3" size={48} />
                            <p className="text-slate-400">No hands played yet</p>
                            <p className="text-slate-500 text-sm mt-1">Your hand history will appear here</p>
                        </div>
                    ) : (
                        history.map((hand) => {
                            const isExpanded = expandedHand === hand.id;
                            const myResult = hand.players.find(p => p.name === currentPlayerName);
                            const didIWin = hand.winner.name === currentPlayerName;

                            return (
                                <div
                                    key={hand.id}
                                    className={`bg-slate-700/30 rounded-xl border ${didIWin ? 'border-amber-500/30' : 'border-white/5'
                                        } overflow-hidden`}
                                >
                                    {/* Hand Summary */}
                                    <button
                                        onClick={() => setExpandedHand(isExpanded ? null : hand.id)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-semibold">Hand #{hand.handNumber}</span>
                                                    {didIWin && (
                                                        <Trophy className="text-amber-400" size={16} />
                                                    )}
                                                </div>
                                                <span className="text-slate-500 text-xs">
                                                    {formatDate(hand.timestamp)} {formatTime(hand.timestamp)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className={`font-bold ${didIWin ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {didIWin ? `+${hand.winner.amount}` : myResult?.result === 'folded' ? 'Folded' : 'Lost'}
                                                </p>
                                                <p className="text-slate-500 text-xs">Pot: {hand.pot}</p>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="text-slate-400" size={20} />
                                            ) : (
                                                <ChevronDown className="text-slate-400" size={20} />
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
                                            {/* Winner */}
                                            <div className="bg-amber-500/10 rounded-lg p-3">
                                                <p className="text-amber-400 text-sm font-semibold flex items-center gap-2">
                                                    <Trophy size={14} />
                                                    {hand.winner.name} wins {hand.winner.amount} chips
                                                    {hand.winner.handRank && (
                                                        <span className="text-amber-300">with {hand.winner.handRank}</span>
                                                    )}
                                                </p>
                                            </div>

                                            {/* Community Cards */}
                                            {hand.communityCards.length > 0 && (
                                                <div>
                                                    <p className="text-slate-500 text-xs mb-2">Community Cards</p>
                                                    <div className="flex gap-2">
                                                        {hand.communityCards.map((card, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="bg-slate-600/50 rounded px-2 py-1"
                                                            >
                                                                <MiniCard rank={card.rank} suit={card.suit} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Players */}
                                            <div>
                                                <p className="text-slate-500 text-xs mb-2">Players</p>
                                                <div className="space-y-2">
                                                    {hand.players.map((player, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center justify-between p-2 rounded-lg ${player.name === currentPlayerName
                                                                    ? 'bg-slate-600/30'
                                                                    : 'bg-slate-700/20'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-sm ${player.name === hand.winner.name
                                                                        ? 'text-amber-400 font-semibold'
                                                                        : 'text-slate-300'
                                                                    }`}>
                                                                    {player.name}
                                                                    {player.name === currentPlayerName && ' (You)'}
                                                                </span>
                                                                {player.cards && player.cards.length > 0 && (
                                                                    <div className="flex gap-1">
                                                                        {player.cards.map((card, cardIdx) => (
                                                                            <span
                                                                                key={cardIdx}
                                                                                className="bg-slate-600/50 rounded px-1"
                                                                            >
                                                                                <MiniCard rank={card.rank} suit={card.suit} />
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`text-xs ${player.result === 'won'
                                                                    ? 'text-emerald-400'
                                                                    : player.result === 'folded'
                                                                        ? 'text-slate-500'
                                                                        : 'text-red-400'
                                                                }`}>
                                                                {player.result === 'won' ? 'Won' : player.result === 'folded' ? 'Folded' : 'Lost'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Actions Timeline */}
                                            {hand.actions.length > 0 && (
                                                <div>
                                                    <p className="text-slate-500 text-xs mb-2">Actions</p>
                                                    <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                                                        {hand.actions.map((action, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="text-xs text-slate-400 flex items-center gap-2"
                                                            >
                                                                <span className="text-slate-600">[{action.phase}]</span>
                                                                <span className={action.playerName === currentPlayerName ? 'text-amber-300' : ''}>
                                                                    {action.playerName}
                                                                </span>
                                                                <span className="text-slate-500">
                                                                    {action.action}
                                                                    {action.amount ? ` ${action.amount}` : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 text-center">
                    <p className="text-slate-500 text-xs">
                        Showing last {history.length} hands
                    </p>
                </div>
            </div>
        </div>
    );
};

// Hand History Button
interface HandHistoryButtonProps {
    onClick: () => void;
    count: number;
}

export const HandHistoryButton: React.FC<HandHistoryButtonProps> = ({ onClick, count }) => {
    return (
        <button
            onClick={onClick}
            className="p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl transition-colors flex items-center gap-2"
        >
            <Clock size={20} className="text-white" />
            {count > 0 && (
                <span className="text-xs text-slate-400">{count}</span>
            )}
        </button>
    );
};
