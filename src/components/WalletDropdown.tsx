import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, ChevronDown, Copy, Check } from 'lucide-react';

interface WalletDropdownProps {
    owner?: string;
    chainId?: string;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    copyToClipboard: (text: string, field: string) => void;
    copiedField: string | null;
}

export const WalletDropdown: React.FC<WalletDropdownProps> = ({
    owner,
    chainId,
    isOpen,
    setIsOpen,
    copyToClipboard,
    copiedField,
}) => {
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
    }, [isOpen, setIsOpen]);

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
                    zIndex: 99998,
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
                    zIndex: 99999,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        Connected to Testnet Conway
                    </div>
                </div>

                <div className="p-3 space-y-3">
                    {/* Owner Address */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Account Owner</label>
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                            <code className="flex-1 text-xs text-slate-300 font-mono truncate">{owner}</code>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (owner) copyToClipboard(owner, 'owner');
                                }}
                                className="p-1.5 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                                title="Copy owner address"
                                type="button"
                            >
                                {copiedField === 'owner' ? (
                                    <Check size={14} className="text-emerald-400" />
                                ) : (
                                    <Copy size={14} className="text-slate-400" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Chain ID */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Chain ID</label>
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                            <code className="flex-1 text-xs text-slate-300 font-mono truncate">{chainId}</code>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (chainId) copyToClipboard(chainId, 'chainId');
                                }}
                                className="p-1.5 hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                                title="Copy chain ID"
                                type="button"
                            >
                                {copiedField === 'chainId' ? (
                                    <Check size={14} className="text-emerald-400" />
                                ) : (
                                    <Copy size={14} className="text-slate-400" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    ) : null;

    return (
        <>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-full border border-slate-700 transition-colors"
            >
                <Wallet size={16} className="text-emerald-400" />
                <span className="text-sm font-bold text-slate-300">
                    {owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : 'Guest'}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Portal dropdown to body */}
            {createPortal(dropdownContent, document.body)}
        </>
    );
};
