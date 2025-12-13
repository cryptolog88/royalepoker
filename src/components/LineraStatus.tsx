import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

interface LineraStatusProps {
    chainId?: string;
    appId?: string;
    owner?: string;
    network?: string;
}

export const LineraStatus: React.FC<LineraStatusProps> = ({
    chainId,
    appId,
    owner,
    network = 'testnet-conway'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
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

    const truncate = (str: string, length: number = 12) => {
        if (!str) return '';
        if (str.length <= length) return str;
        return `${str.slice(0, length / 2)}...${str.slice(-length / 2)}`;
    };

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

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
                <div className="p-3 border-b border-slate-700 bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <h3 className="font-bold text-sm text-white">Linera Network Status</h3>
                    </div>
                </div>

                <div className="p-3 space-y-3">
                    {/* Network */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Network</label>
                        <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                            <span className="text-xs text-blue-400 font-mono">{network}</span>
                        </div>
                    </div>

                    {/* Chain ID */}
                    {chainId && (
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Chain ID</label>
                            <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                                <code className="flex-1 text-xs text-purple-400 font-mono truncate" title={chainId}>
                                    {truncate(chainId, 20)}
                                </code>
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(chainId, 'chain'); }}
                                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                                >
                                    {copiedField === 'chain' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* App ID */}
                    {appId && (
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">App ID</label>
                            <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                                <code className="flex-1 text-xs text-emerald-400 font-mono truncate" title={appId}>
                                    {truncate(appId, 20)}
                                </code>
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(appId, 'app'); }}
                                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                                >
                                    {copiedField === 'app' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Owner */}
                    {owner && (
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Owner</label>
                            <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                                <code className="flex-1 text-xs text-amber-400 font-mono truncate" title={owner}>
                                    {truncate(owner, 20)}
                                </code>
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(owner, 'owner'); }}
                                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                                >
                                    {copiedField === 'owner' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-400" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Explorer Link */}
                <div className="p-3 border-t border-slate-700 bg-slate-900/30">
                    <a
                        href={`https://explorer.testnet-conway.linera.net/chains/${chainId}/applications/${appId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-semibold transition-colors"
                    >
                        <ExternalLink size={14} />
                        <span>View on Explorer</span>
                    </a>
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
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-600 transition-all"
            >
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">Linera</span>
                <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Portal dropdown to body */}
            {createPortal(dropdownContent, document.body)}
        </>
    );
};
