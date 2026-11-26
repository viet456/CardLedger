'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useIsOffline } from './OfflineProvider';

type Session = typeof authClient.$Infer.Session;

const SessionContext = createContext<Session | null>(null);
const CACHE_KEY = 'cardledger-session-cache';

let lastRawSessionCache: string | null = null;
let lastParsedSessionCache: Session | null = null;
const sessionCacheListeners = new Set<() => void>();

function notifySessionCacheListeners() {
    for (const listener of sessionCacheListeners) {
        listener();
    }
}

function subscribeSessionCache(callback: () => void) {
    sessionCacheListeners.add(callback);
    const handleStorage = (e: StorageEvent) => {
        if (e.key === CACHE_KEY || e.key === null) {
            callback();
        }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
        sessionCacheListeners.delete(callback);
        window.removeEventListener('storage', handleStorage);
    };
}

function getClientSessionSnapshot(): Session | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw === lastRawSessionCache) {
            return lastParsedSessionCache;
        }
        lastRawSessionCache = raw;
        lastParsedSessionCache = raw ? (JSON.parse(raw) as Session) : null;
        return lastParsedSessionCache;
    } catch (e) {
        console.error('Failed to parse session cache', e);
        return null;
    }
}

const getServerSessionSnapshot = (): Session | null => null;

export const SessionProvider = ({
    children,
    initialSession
}: {
    children: React.ReactNode;
    initialSession: Session | null;
}) => {
    return <SessionContext value={initialSession}>{children}</SessionContext>;
};

export const useAuthSession = () => {
    const contextSession = useContext(SessionContext);
    const betterAuthSession = authClient.useSession();
    const isOffline = useIsOffline();
    const cachedSession = useSyncExternalStore(
        subscribeSessionCache,
        getClientSessionSnapshot,
        getServerSessionSnapshot
    );

    // Session cache updates
    useEffect(() => {
        if (!isOffline && !betterAuthSession.isPending) {
            if (betterAuthSession.data) {
                // Legitimate active session
                const serialized = JSON.stringify(betterAuthSession.data);
                if (localStorage.getItem(CACHE_KEY) !== serialized) {
                    localStorage.setItem(CACHE_KEY, serialized);
                    notifySessionCacheListeners();
                }
            } else if (betterAuthSession.data === null && !betterAuthSession.error) {
                // Only wipe cache if data is null AND there is NO network error.
                // This means the server explicitly confirmed the user is logged out.
                if (localStorage.getItem(CACHE_KEY) !== null) {
                    localStorage.removeItem(CACHE_KEY);
                    notifySessionCacheListeners();
                }
            }
        }
    }, [betterAuthSession.data, betterAuthSession.isPending, betterAuthSession.error, isOffline]);

    // Offline / error interception
    // If the browser says we are offline, OR if BetterAuth throws a fetch error:
    if (isOffline || betterAuthSession.error) {
        return {
            ...betterAuthSession,
            data: cachedSession || contextSession, // Serve the cached identity immediately
            isPending: false,
            error: null
        };
    }

    const hasResolved = !betterAuthSession.isPending || betterAuthSession.data !== undefined;

    // Optimistic session fallback
    const effectiveData = hasResolved
        ? betterAuthSession.data
        : (contextSession ?? cachedSession ?? betterAuthSession.data);

    return {
        ...betterAuthSession,
        data: effectiveData
    };
};