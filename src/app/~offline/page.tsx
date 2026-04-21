'use client';

import { WifiOff } from 'lucide-react';
import { OfflineCardView } from '../cards/[cardId]/OfflineCardView';
import CardPageView from '../cards/CardPageView';

function getRouteInfo() {
    if (typeof window === 'undefined') {
        return { type: 'generic' as const, cardId: null };
    }
    
    const path = window.location.pathname;
    if (path.startsWith('/cards/') && path.length > 7) {
        const cardId = path.split('/')[2];
        if (cardId) return { type: 'card' as const, cardId };
    }
    if (path === '/cards') return { type: 'grid' as const, cardId: null };
    return { type: 'generic' as const, cardId: null };
}

export default function OfflineFallback() {
    const { type, cardId } = getRouteInfo();

    if (type === 'card' && cardId) {
        return <OfflineCardView cardId={cardId} />;
    }

    if (type === 'grid') {
        return (
            <div className="flex flex-col min-h-screen">
                <CardPageView />
            </div>
        );
    }

    return (
        <main className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
            <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-4xl font-bold tracking-tight">You are offline.</h1>
            <p className="mt-4 max-w-md text-muted-foreground">
                CardLedger is running in local-first mode.
                You can still browse your collection and view downloaded cards.
            </p>
        </main>
    );
}