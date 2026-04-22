'use client';

import { WifiOff } from 'lucide-react';
import { useIsOffline } from '@/src/providers/OfflineProvider';

export function GlobalOfflineBanner() {
    const isOffline = useIsOffline();
    if (!isOffline) return null;

    return (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-500 flex items-center justify-center gap-2 py-2 text-sm font-medium z-50">
            <WifiOff className="h-4 w-4" />
            <span>Offline Mode: Browsing local index</span>
        </div>
    );
}