import React from 'react';
import { Settings } from 'lucide-react';

export interface AutoActionSettings {
    autoFold: boolean;
    autoCheckFold: boolean;
    autoCall: boolean;
    sitOut: boolean;
}

interface AutoActionsProps {
    settings: AutoActionSettings;
    onSettingsChange: (settings: AutoActionSettings) => void;
    isMyTurn: boolean;
    isOpen: boolean;
    onToggle: () => void;
}

export const AutoActions: React.FC<AutoActionsProps> = ({
    settings,
    onSettingsChange,
    isMyTurn,
    isOpen,
    onToggle,
}) => {
    const handleToggle = (key: keyof AutoActionSettings) => {
        // If enabling one auto-action, disable others (except sitOut which is separate)
        if (key === 'sitOut') {
            onSettingsChange({
                ...settings,
                sitOut: !settings.sitOut,
            });
        } else {
            const newSettings: AutoActionSettings = {
                autoFold: false,
                autoCheckFold: false,
                autoCall: false,
                sitOut: settings.sitOut,
            };
            newSettings[key] = !settings[key];
            onSettingsChange(newSettings);
        }
    };

    return (
        <div className="relative">
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className={`p-3 rounded-xl border transition-colors ${settings.sitOut
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                        : settings.autoFold || settings.autoCheckFold || settings.autoCall
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-slate-800/80 border-white/10 text-white hover:bg-slate-700/80'
                    }`}
            >
                <Settings size={20} />
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl p-3 space-y-2">
                    <h4 className="text-white font-semibold text-sm mb-3">Auto Actions</h4>

                    {/* Sit Out */}
                    <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${settings.sitOut ? 'bg-orange-500/20' : 'hover:bg-white/5'
                        }`}>
                        <div>
                            <span className={`text-sm ${settings.sitOut ? 'text-orange-400' : 'text-slate-300'}`}>
                                Sit Out / Away
                            </span>
                            <p className="text-xs text-slate-500">Auto-fold until you return</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.sitOut}
                            onChange={() => handleToggle('sitOut')}
                            className="w-4 h-4 accent-orange-500"
                        />
                    </label>

                    <div className="border-t border-white/10 my-2"></div>

                    {/* Auto Fold */}
                    <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${settings.autoFold ? 'bg-red-500/20' : 'hover:bg-white/5'
                        } ${settings.sitOut ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <span className={`text-sm ${settings.autoFold ? 'text-red-400' : 'text-slate-300'}`}>
                                Auto Fold
                            </span>
                            <p className="text-xs text-slate-500">Fold on your next turn</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.autoFold}
                            onChange={() => handleToggle('autoFold')}
                            disabled={settings.sitOut}
                            className="w-4 h-4 accent-red-500"
                        />
                    </label>

                    {/* Auto Check/Fold */}
                    <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${settings.autoCheckFold ? 'bg-blue-500/20' : 'hover:bg-white/5'
                        } ${settings.sitOut ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <span className={`text-sm ${settings.autoCheckFold ? 'text-blue-400' : 'text-slate-300'}`}>
                                Check / Fold
                            </span>
                            <p className="text-xs text-slate-500">Check if free, else fold</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.autoCheckFold}
                            onChange={() => handleToggle('autoCheckFold')}
                            disabled={settings.sitOut}
                            className="w-4 h-4 accent-blue-500"
                        />
                    </label>

                    {/* Auto Call */}
                    <label className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${settings.autoCall ? 'bg-emerald-500/20' : 'hover:bg-white/5'
                        } ${settings.sitOut ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <span className={`text-sm ${settings.autoCall ? 'text-emerald-400' : 'text-slate-300'}`}>
                                Call Any
                            </span>
                            <p className="text-xs text-slate-500">Auto-call any bet</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.autoCall}
                            onChange={() => handleToggle('autoCall')}
                            disabled={settings.sitOut}
                            className="w-4 h-4 accent-emerald-500"
                        />
                    </label>

                    {/* Status indicator */}
                    {(settings.autoFold || settings.autoCheckFold || settings.autoCall || settings.sitOut) && (
                        <div className="mt-3 pt-2 border-t border-white/10">
                            <p className="text-xs text-center">
                                {settings.sitOut ? (
                                    <span className="text-orange-400">🚶 You are sitting out</span>
                                ) : settings.autoFold ? (
                                    <span className="text-red-400">Will fold next turn</span>
                                ) : settings.autoCheckFold ? (
                                    <span className="text-blue-400">Will check or fold</span>
                                ) : settings.autoCall ? (
                                    <span className="text-emerald-400">Will call any bet</span>
                                ) : null}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Sit Out Badge - shows on player avatar when sitting out
export const SitOutBadge: React.FC = () => (
    <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
        AWAY
    </div>
);
