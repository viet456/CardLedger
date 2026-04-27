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

    // Session cache updates
    useEffect(() => {
        if (!isOffline && !betterAuthSession.isPending) {
            if (betterAuthSession.data) {
                // Legitimate active session
                localStorage.setItem(CACHE_KEY, JSON.stringify(betterAuthSession.data));
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCachedSession(betterAuthSession.data);
                
            } else if (betterAuthSession.data === null && !betterAuthSession.error) {
                // Only wipe cache if data is null AND there is NO network error.
                // This means the server explicitly confirmed the user is logged out.
                localStorage.removeItem(CACHE_KEY);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCachedSession(null);
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
        data: effectiveData,
    };
};