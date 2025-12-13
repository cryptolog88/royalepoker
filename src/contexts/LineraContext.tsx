import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import initLinera, { Client, Faucet, Wallet, Application } from '@linera/client';
import { PrivateKey } from '@linera/signer';
import { ethers } from 'ethers';

// Constants
const FAUCET_URL = import.meta.env.VITE_LINERA_FAUCET || 'https://faucet.testnet-conway.linera.net';
const APP_ID = import.meta.env.VITE_LINERA_APP_ID;
const ARENA_APP_ID = import.meta.env.VITE_ARENA_APP_ID;
const DB_NAME = 'royale_poker_wallet';
const STORE_NAME = 'wallet_data';

// Browser detection - Linera WASM has issues with Firefox
const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox');
if (isFirefox) {
    console.warn('⚠️ Firefox detected - Linera WASM client may have compatibility issues. Game will work but blockchain features may be limited.');
}

interface WalletData {
    mnemonic: string;
    chainId: string;
    owner: string;
    createdAt: number;
}

interface LineraContextType {
    client?: Client;
    wallet?: Wallet;
    chainId?: string;
    owner?: string;
    application?: Application;
    arenaApplication?: Application;
    loading: boolean;
    status: 'Initializing' | 'Idle' | 'Creating Wallet' | 'Claiming Chain' | 'Connecting' | 'Ready' | 'Error';
    error?: string;
    walletExists: boolean;
    createWallet: () => Promise<void>;
    resetWallet: () => void;
}

const LineraContext = createContext<LineraContextType>({
    loading: true,
    status: 'Initializing',
    walletExists: false,
    createWallet: async () => { },
    resetWallet: () => { },
});

export const useLinera = () => useContext(LineraContext);

// IndexedDB helpers
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const saveWalletData = async (data: WalletData): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: 'primary', ...data });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
};

const loadWalletData = async (): Promise<WalletData | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('primary');
            request.onsuccess = () => { db.close(); resolve(request.result || null); };
            request.onerror = () => { db.close(); reject(request.error); };
        });
    } catch {
        return null;
    }
};

const clearWalletData = async (): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    } catch {
        // Ignore errors on clear
    }
};

const checkWalletExists = async (): Promise<boolean> => {
    const data = await loadWalletData();
    return data !== null && !!data.mnemonic && !!data.chainId;
};

// Helper to retry faucet operations
const withRetry = async <T,>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 2000
): Promise<T> => {
    let lastError: Error | undefined;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`⚠️ Attempt ${i + 1}/${maxRetries} failed:`, lastError.message);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
};

export const LineraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<Omit<LineraContextType, 'createWallet' | 'resetWallet'>>({
        loading: true,
        status: 'Initializing',
        walletExists: false,
    });
    const initRef = useRef(false);
    const clientRef = useRef<Client | null>(null);

    // Initialize WASM and check for existing wallet
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const init = async () => {
            try {
                console.log('🔧 Initializing Linera WASM...');
                if (isFirefox) {
                    console.log('🦊 Firefox detected - attempting WASM initialization...');
                }

                // Always try to initialize Linera WASM (including Firefox)
                await initLinera();
                console.log('✅ Linera WASM initialized successfully');

                const exists = await checkWalletExists();
                console.log('💼 Wallet exists:', exists);

                if (exists) {
                    setState(prev => ({ ...prev, status: 'Connecting', walletExists: true }));
                    await connectExistingWallet();
                } else {
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        status: 'Idle',
                        walletExists: false,
                    }));
                }
            } catch (err) {
                console.error('❌ Initialization error:', err);
                // On error, try fallback mode with stored wallet data
                const exists = await checkWalletExists();
                if (exists) {
                    const walletData = await loadWalletData();
                    if (walletData) {
                        setState(prev => ({
                            ...prev,
                            chainId: walletData.chainId,
                            owner: walletData.owner,
                            loading: false,
                            status: 'Ready' as const,
                            walletExists: true,
                            error: 'Blockchain features limited - WASM initialization failed',
                        }));
                        console.log('✅ Fallback mode ready after error - UI will work, blockchain logging limited');
                        return;
                    }
                }
                setState(prev => ({
                    ...prev,
                    loading: false,
                    status: 'Error',
                    error: err instanceof Error ? err.message : 'Failed to initialize',
                }));
            }
        };

        init();

        return () => {
            if (clientRef.current) {
                try {
                    clientRef.current.stop();
                    clientRef.current.free();
                } catch { }
            }
        };
    }, []);

    const connectExistingWallet = async () => {
        try {
            const walletData = await loadWalletData();
            if (!walletData) throw new Error('No wallet data found');

            console.log('🔗 Reconnecting wallet...');
            console.log('👤 Owner:', walletData.owner);
            console.log('⛓️  Stored Chain:', walletData.chainId);

            const signer = PrivateKey.fromMnemonic(walletData.mnemonic);

            // First, set UI ready with stored data
            setState(prev => ({
                ...prev,
                chainId: walletData.chainId,
                owner: walletData.owner,
                loading: false,
                status: 'Ready' as const,
                walletExists: true,
            }));
            console.log('✅ UI ready with stored data');

            // Then try to connect blockchain in background
            try {
                console.log('🔌 Connecting to blockchain...');
                const faucet = new Faucet(FAUCET_URL);
                const wallet = await faucet.createWallet();
                const newChainId = await faucet.claimChain(wallet, signer.address());

                console.log('⛓️  New chain claimed:', newChainId);

                // Update stored chainId
                await saveWalletData({ ...walletData, chainId: newChainId });

                // Create client with timeout to prevent hanging
                const clientPromise = new Client(wallet, signer, false);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Client connection timeout')), 10000)
                );

                const client = await Promise.race([clientPromise, timeoutPromise]) as Client;
                clientRef.current = client;

                // Try to get applications
                let application: Application | undefined;
                let arenaApplication: Application | undefined;

                if (APP_ID) {
                    try {
                        application = await client.frontend().application(APP_ID);
                        console.log('📱 Poker Application connected:', APP_ID);
                    } catch (err) {
                        console.warn('⚠️ Could not connect to poker application:', err);
                    }
                }

                if (ARENA_APP_ID) {
                    try {
                        arenaApplication = await client.frontend().application(ARENA_APP_ID);
                        console.log('🏟️ Arena Application connected:', ARENA_APP_ID);
                    } catch (err) {
                        console.warn('⚠️ Could not connect to arena application:', err);
                    }
                }

                setState(prev => ({
                    ...prev,
                    client,
                    wallet,
                    chainId: newChainId,
                    application,
                    arenaApplication,
                }));
                console.log('✅ Blockchain connected');
            } catch (blockchainErr) {
                console.warn('⚠️ Blockchain connection failed (UI still works):', blockchainErr);
                // UI is already ready, just log the error
            }
        } catch (err) {
            console.error('❌ Failed to load wallet:', err);
            await clearWalletData();
            setState(prev => ({
                ...prev,
                loading: false,
                status: 'Idle',
                walletExists: false,
                error: 'Failed to load wallet. Please create a new one.',
            }));
        }
    };

    const createWallet = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, status: 'Creating Wallet', error: undefined }));

            // Generate new mnemonic
            const mnemonic = ethers.Wallet.createRandom().mnemonic!.phrase;

            if (isFirefox) {
                console.log('🦊 Firefox detected - attempting full wallet creation...');
            }

            const signer = PrivateKey.fromMnemonic(mnemonic);
            const owner = signer.address().toString();

            console.log('🔑 Generated new wallet');
            console.log('👤 Owner:', owner);

            setState(prev => ({ ...prev, status: 'Claiming Chain' }));

            // Create wallet and claim chain from faucet with retries
            const faucet = new Faucet(FAUCET_URL);
            const wallet = await withRetry(() => faucet.createWallet(), 3, 2000);
            const chainId = await withRetry(() => faucet.claimChain(wallet, signer.address()), 3, 2000);

            console.log('⛓️  Claimed chain:', chainId);

            // Save wallet data to IndexedDB
            await saveWalletData({
                mnemonic,
                chainId,
                owner,
                createdAt: Date.now(),
            });

            // Set UI ready first
            setState(prev => ({
                ...prev,
                chainId,
                owner,
                loading: false,
                status: 'Ready' as const,
                walletExists: true,
            }));
            console.log('✅ UI ready, wallet created');

            // Connect client in background
            try {
                console.log('🔌 Connecting client...');
                const clientPromise = new Client(wallet, signer, false);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Client connection timeout')), 10000)
                );

                const client = await Promise.race([clientPromise, timeoutPromise]) as Client;
                clientRef.current = client;

                let application: Application | undefined;
                let arenaApplication: Application | undefined;

                if (APP_ID) {
                    try {
                        application = await client.frontend().application(APP_ID);
                        console.log('📱 Poker Application connected:', APP_ID);
                    } catch (err) {
                        console.warn('⚠️ Could not connect to poker application:', err);
                    }
                }

                if (ARENA_APP_ID) {
                    try {
                        arenaApplication = await client.frontend().application(ARENA_APP_ID);
                        console.log('🏟️ Arena Application connected:', ARENA_APP_ID);
                    } catch (err) {
                        console.warn('⚠️ Could not connect to arena application:', err);
                    }
                }

                setState(prev => ({ ...prev, client, wallet, application, arenaApplication }));
                console.log('✅ Blockchain client connected');
            } catch (clientErr) {
                console.warn('⚠️ Client connection failed (UI still works):', clientErr);
            }
        } catch (err) {
            console.error('❌ Failed to create wallet:', err);
            setState(prev => ({
                ...prev,
                loading: false,
                status: 'Error',
                error: err instanceof Error ? err.message : 'Failed to create wallet',
            }));
        }
    };

    const resetWallet = async () => {
        // Cleanup client
        if (clientRef.current) {
            try {
                clientRef.current.stop();
                clientRef.current.free();
            } catch { }
            clientRef.current = null;
        }

        // Clear stored data
        await clearWalletData();

        // Reset state
        setState({
            loading: false,
            status: 'Idle',
            walletExists: false,
        });

        console.log('🗑️ Wallet reset');
    };

    return (
        <LineraContext.Provider value={{ ...state, createWallet, resetWallet }}>
            {children}
        </LineraContext.Provider>
    );
};
