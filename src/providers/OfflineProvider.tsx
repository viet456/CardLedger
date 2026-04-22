'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';

const OfflineContext = createContext(false);
const STORAGE_KEY = 'was-offline';

async function checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) return true;
    try {
        await fetch(`/favicon.ico?_=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
        return false;
    } catch {
        return true;
    }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
    const [isOffline, setIsOffline] = useState(false);
    const onlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
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
            onlineTimeoutRef.current = setTimeout(() => {
                checkConnectivity().then(updateOfflineState);
            }, 1000);
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