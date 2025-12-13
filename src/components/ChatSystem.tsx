import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, X } from 'lucide-react';

export interface ChatMessage {
    id: string;
    playerName: string;
    message: string;
    timestamp: number;
    type: 'chat' | 'action' | 'system';
}

interface ChatSystemProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    playerName: string;
    isOpen: boolean;
    onClose: () => void;
    unreadCount: number;
}

const QUICK_EMOJIS = ['👍', '😂', '🔥', '😎', '🎉', '💪', '🤔', '😢'];

const QUICK_MESSAGES = [
    'Good luck!',
    'Nice hand!',
    'Well played!',
    'Thanks!',
    'gg',
];

export const ChatSystem: React.FC<ChatSystemProps> = ({
    messages,
    onSendMessage,
    playerName,
    isOpen,
    onClose,
    unreadCount,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showEmojis, setShowEmojis] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-20 right-4 w-80 bg-slate-800/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col max-h-96">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10">
                <h3 className="text-white font-semibold">Table Chat</h3>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[250px] scrollbar-thin">
                {messages.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No messages yet. Say hi! 👋</p>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`${msg.type === 'system'
                                    ? 'text-center'
                                    : msg.playerName === playerName
                                        ? 'text-right'
                                        : 'text-left'
                                }`}
                        >
                            {msg.type === 'system' ? (
                                <span className="text-xs text-slate-500 italic">{msg.message}</span>
                            ) : msg.type === 'action' ? (
                                <span className="text-xs text-amber-400">
                                    {msg.playerName} {msg.message}
                                </span>
                            ) : (
                                <div
                                    className={`inline-block max-w-[80%] ${msg.playerName === playerName
                                            ? 'bg-amber-500/20 text-amber-100'
                                            : 'bg-slate-700/50 text-slate-200'
                                        } rounded-xl px-3 py-2`}
                                >
                                    {msg.playerName !== playerName && (
                                        <p className="text-xs text-slate-400 mb-1">{msg.playerName}</p>
                                    )}
                                    <p className="text-sm break-words">{msg.message}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{formatTime(msg.timestamp)}</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Messages */}
            <div className="px-3 py-2 border-t border-white/5">
                <div className="flex gap-1 flex-wrap">
                    {QUICK_MESSAGES.map((msg) => (
                        <button
                            key={msg}
                            onClick={() => onSendMessage(msg)}
                            className="text-xs bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-2 py-1 rounded-full transition-colors"
                        >
                            {msg}
                        </button>
                    ))}
                </div>
            </div>

            {/* Emoji Picker */}
            {showEmojis && (
                <div className="px-3 py-2 border-t border-white/5 flex gap-2 flex-wrap">
                    {QUICK_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => {
                                setInputValue((prev) => prev + emoji);
                                setShowEmojis(false);
                            }}
                            className="text-xl hover:scale-125 transition-transform"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/10 flex gap-2">
                <button
                    onClick={() => setShowEmojis(!showEmojis)}
                    className={`p-2 rounded-lg transition-colors ${showEmojis ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'
                        }`}
                >
                    <Smile size={18} />
                </button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                    maxLength={100}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 rounded-lg transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

// Chat Button Component
interface ChatButtonProps {
    onClick: () => void;
    unreadCount: number;
}

export const ChatButton: React.FC<ChatButtonProps> = ({ onClick, unreadCount }) => {
    return (
        <button
            onClick={onClick}
            className="relative p-3 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl transition-colors"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
