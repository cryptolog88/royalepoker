import React from 'react';
import { useLinera } from '../contexts/LineraContext';
import { Wallet, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const WalletSetup: React.FC = () => {
    const { status, loading, error, walletExists, createWallet, resetWallet } = useLinera();

    if (walletExists && status === 'Ready') {
        return null; // Wallet ready, don't show setup
    }

    const getStatusMessage = () => {
        switch (status) {
            case 'Initializing': return 'Initializing Linera...';
            case 'Creating Wallet': return 'Creating your wallet...';
            case 'Claiming Chain': return 'Claiming chain from faucet...';
            case 'Connecting': return 'Connecting to network...';
            case 'Error': return error || 'An error occurred';
            default: return '';
        }
    };

    const getStatusIcon = () => {
        if (loading) {
            return <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />;
        }
        if (status === 'Error') {
            return <AlertCircle className="w-8 h-8 text-rose-400" />;
        }
        if (status === 'Ready') {
            return <CheckCircle className="w-8 h-8 text-emerald-400" />;
        }
        return <Wallet className="w-8 h-8 text-amber-400" />;
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 border border-slate-700">
                        {getStatusIcon()}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-serif font-bold text-amber-500 mb-2">
                        {loading ? 'Setting Up' : status === 'Error' ? 'Error' : 'Welcome to Royale Poker'}
                    </h2>

                    {/* Description */}
                    <p className="text-slate-400 text-sm mb-6 max-w-xs">
                        {loading ? (
                            getStatusMessage()
                        ) : status === 'Error' ? (
                            <span className="text-rose-400">{error}</span>
                        ) : (
                            'Create a blockchain wallet to start playing. Your wallet will be stored securely in your browser.'
                        )}
                    </p>

                    {/* Progress Steps */}
                    {loading && (
                        <div className="w-full mb-6">
                            <div className="flex flex-col gap-2">
                                <ProgressStep
                                    label="Creating Wallet"
                                    active={status === 'Creating Wallet'}
                                    done={['Claiming Chain', 'Connecting', 'Ready'].includes(status)}
                                />
                                <ProgressStep
                                    label="Claiming Chain"
                                    active={status === 'Claiming Chain'}
                                    done={['Connecting', 'Ready'].includes(status)}
                                />
                                <ProgressStep
                                    label="Connecting"
                                    active={status === 'Connecting'}
                                    done={status === 'Ready'}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {!loading && (
                        <div className="flex flex-col gap-3 w-full">
                            {status === 'Error' ? (
                                <>
                                    <button
                                        onClick={createWallet}
                                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-all"
                                    >
                                        Try Again
                                    </button>
                                    <button
                                        onClick={resetWallet}
                                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={16} />
                                        Reset & Start Fresh
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={createWallet}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Create Wallet
                                </button>
                            )}
                        </div>
                    )}

                    {/* Network Info */}
                    <div className="mt-6 pt-4 border-t border-slate-700 w-full">
                        <p className="text-xs text-slate-500">
                            Network: <span className="text-emerald-400">Linera Testnet Conway</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProgressStep: React.FC<{ label: string; active: boolean; done: boolean }> = ({ label, active, done }) => (
    <div className={`flex items-center gap-3 text-sm transition-all ${active || done ? 'opacity-100' : 'opacity-40'}`}>
        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${done ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
            active ? 'bg-amber-500/20 border-amber-500/50' : 'border-slate-700'
            }`}>
            {done ? (
                <CheckCircle size={12} />
            ) : active ? (
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            ) : null}
        </div>
        <span className={done ? 'text-slate-500' : 'text-slate-300'}>{label}</span>
    </div>
);

export default WalletSetup;
