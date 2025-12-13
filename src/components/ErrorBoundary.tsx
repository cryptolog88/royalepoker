import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('🔴 ErrorBoundary caught:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
                    <div className="bg-slate-800 p-8 rounded-xl border border-rose-500/50 max-w-lg">
                        <h1 className="text-2xl font-bold text-rose-400 mb-4">Something went wrong</h1>
                        <p className="text-slate-300 mb-4">{this.state.error?.message}</p>
                        <pre className="bg-slate-900 p-4 rounded text-xs text-slate-400 overflow-auto max-h-48">
                            {this.state.error?.stack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
