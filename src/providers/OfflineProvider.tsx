'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useCollectionStore } from '../lib/store/collectionStore';

const OfflineContext = createContext(false);
const STORAGE_KEY = 'was-offline';

async function checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) return true;
    try {
        // Ping an API path instead of an image. Service Workers rarely cache API routes.
        await fetch(`/api/ping-network?_=${Date.now()}`, { 
            method: 'HEAD', 
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        return false; // Fetch succeeded, we are Online!
    } catch {
        return true; // Fetch failed, we are Offline!
    }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
    const [isOffline, setIsOffline] = useState(false);
    const onlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Request Persistent Storage
        // Asks the OS not to silently delete our 3 IDB stores if the phone gets full.
        const requestPersistentStorage = async () => {
            if (navigator.storage && navigator.storage.persist) {
                const isPersisted = await navigator.storage.persist();
                // Only log the storage status in non-production environments
                if (process.env.NODE_ENV !== 'production') {
                    if (isPersisted) {
                        console.log('[Storage] Persistent storage granted by browser.');
                    } else {
                        console.log('[Storage] Running in temporary best-effort mode.');
                    }
                }
            }
        };
        requestPersistentStorage();

        const updateOfflineState = (offline: boolean) => {
            sessionStorage.setItem(STORAGE_KEY, String(offline));
            setIsOffline(offline);
        };

        const initializeNetworkState = async () => {
            const storedState = sessionStorage.getItem(STORAGE_KEY) === 'true';
            if (storedState) setIsOffline(true);

            const actualState = await checkConnectivity();
            updateOfflineState(actualState);
        };

        initializeNetworkState();

        const handleOffline = () => {
            if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
            updateOfflineState(true);
        };

        const handleOnline = () => {
            if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
            
            // Optimistically hide the offline banner instantly for a snappy UI
            updateOfflineState(false);

            // Create a retry loop because DNS takes a few seconds to establish
            const verifyConnection = (attemptsLeft: number) => {
                checkConnectivity().then((isActuallyOffline) => {
                    if (!isActuallyOffline) {
                        // Confirmed! We have real internet. Flush the queue.
                        updateOfflineState(false);
                        useCollectionStore.getState().processQueue();
                    } else if (attemptsLeft > 0 && navigator.onLine) {
                        // OS says online, but fetch failed (router is still waking up). 
                        // Wait 2 seconds and retry.
                        onlineTimeoutRef.current = setTimeout(() => verifyConnection(attemptsLeft - 1), 2000);
                    } else {
                        // We gave up, or the OS said offline again (eg connected to a router with no internet).
                        updateOfflineState(true);
                    }
                });
            };

            // Start the first real ping after 1.5 seconds, and try up to 5 times
            onlineTimeoutRef.current = setTimeout(() => verifyConnection(5), 1500);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            if (onlineTimeoutRef.current) clearTimeout(onlineTimeoutRef.current);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    return (
        <OfflineContext.Provider value={isOffline}>
            {children}
        </OfflineContext.Provider>
    );
}

export const useIsOffline = () => useContext(OfflineContext);