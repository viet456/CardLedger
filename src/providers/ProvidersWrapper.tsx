'use client';

import { ThemeProvider } from '@/src/components/layout/theme-provider';
import { trpc, trpcClient } from '@/src/utils/trpc';
import { TooltipProvider } from '../components/ui/tooltip';
import { Toaster } from '../components/ui/sonner';
import { SessionProvider } from './SessionProvider';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function ProvidersWrapper({
    children,
    session
}: {
    children: React.ReactNode;
    session: any;
}) {
    const [queryClient] = useState(() => new QueryClient());
    return (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <SessionProvider initialSession={session}>
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange
                    >
                        <TooltipProvider>{children}</TooltipProvider>
                        <Toaster />
                    </ThemeProvider>
                </SessionProvider>
            </QueryClientProvider>
        </trpc.Provider>
    );
}
