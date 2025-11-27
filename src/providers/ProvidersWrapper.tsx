'use client';

import { ThemeProvider } from '@/src/components/layout/theme-provider';
import { TrpcProvider } from '../providers/TRPCProvider';
import { TooltipProvider } from '../components/ui/tooltip';
import { Toaster } from '../components/ui/sonner';

export function ProvidersWrapper({ children }: { children: React.ReactNode }) {
    return (
        <TrpcProvider>
            <ThemeProvider
                attribute='class'
                defaultTheme='system'
                enableSystem
                disableTransitionOnChange
            >
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster />
            </ThemeProvider>
        </TrpcProvider>
    );
}
