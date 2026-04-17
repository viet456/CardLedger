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

    // Only use the SSR session if the client has NEVER successfully fetched yet.
    // Once it has fetched (even if the result is null/signed-out), trust the client.
    const hasResolved = !betterAuthSession.isPending || betterAuthSession.data !== undefined;

    const effectiveData = hasResolved
        ? betterAuthSession.data
        : (contextSession ?? betterAuthSession.data);

    return {
        ...betterAuthSession,
        data: effectiveData,
    };
};
