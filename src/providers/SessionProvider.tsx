'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '@/src/lib/auth-client';
import { useIsOffline } from './OfflineProvider';

type Session = typeof authClient.$Infer.Session;

const SessionContext = createContext<Session | null>(null);
const CACHE_KEY = 'cardledger-session-cache';

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
    const [cachedSession, setCachedSession] = useState<Session | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) return JSON.parse(cached);
            } catch (e) {
                console.error('Failed to parse session cache', e);
            }
        }
        return null;
    });

    // Sync valid online sessions to the cache
    useEffect(() => {
        // Only update the cache if we are online and the auth client has finished checking
        if (!isOffline && !betterAuthSession.isPending) {
            if (betterAuthSession.data) {
                // User is actively logged in
                localStorage.setItem(CACHE_KEY, JSON.stringify(betterAuthSession.data));
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCachedSession(betterAuthSession.data);
            } else if (betterAuthSession.data === null) {
                // User explicitly signed out while online -> wipe the cache
                localStorage.removeItem(CACHE_KEY);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCachedSession(null);
            }
        }
    }, [betterAuthSession.data, betterAuthSession.isPending, isOffline]);

    if (isOffline) {
        return {
            ...betterAuthSession,
            data: cachedSession || contextSession, // Serve the cached identity
            isPending: false,                      // Force resolve to prevent UI loading spinners
            error: null                            // Suppress Better-Auth's internal network failure errors
        };
    }

    // Only use the SSR session if the client has NEVER successfully fetched yet.
    // Once it has fetched (even if the result is null/signed-out), trust the client.
    const hasResolved = !betterAuthSession.isPending || betterAuthSession.data !== undefined;

    const effectiveData = hasResolved
        ? betterAuthSession.data
        : (contextSession ?? cachedSession ?? betterAuthSession.data);

    return {
        ...betterAuthSession,
        data: effectiveData,
    };
};
