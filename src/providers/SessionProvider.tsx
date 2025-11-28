'use client';

import React, { createContext, useContext } from 'react';
import { authClient } from '@/src/lib/auth-client';

type Session = typeof authClient.$Infer.Session;

const SessionContext = createContext<Session | null>(null);

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

    // If better-auth is still loading (isPending = true), use the contextSession (Server Data).
    // If better-auth is done (isPending = false), use the betterAuthSession (Client Data).
    // This ensures instant loading BUT allows the client to update (ex on logout).

    const isActuallyPending = betterAuthSession.isPending && !contextSession;
    const effectiveData = betterAuthSession.isPending
        ? betterAuthSession.data || contextSession
        : betterAuthSession.data;

    return {
        ...betterAuthSession,
        data: effectiveData,
        isPending: isActuallyPending
    };
};
