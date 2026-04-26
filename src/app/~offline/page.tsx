'use client';

import { WifiOff } from 'lucide-react';
import { OfflineCardView } from './OfflineCardView';
import CardPageView from '../cards/CardPageView';
import { OfflineSetDetailView } from './OfflineSetDetailView';
import { OfflineSetsView } from './OfflineSetsView';
import { DashboardClient } from '../dashboard/_components/DashboardClient';

function getRouteInfo() {
    if (typeof window === 'undefined') {
        return { type: 'generic' as const, id: null };
    }
    
    const path = window.location.pathname;

    // /dashboard routing
    if (path === '/dashboard') return { type: 'dashboard' as const, id: null };

    // /cards routing 
    if (path.startsWith('/cards/') && path.length > 7) {
        const id = path.split('/')[2];
        if (id) return { type: 'card' as const, id };
    }
    if (path === '/cards') return { type: 'cardGrid' as const, id: null };

    // /sets routing
    if (path.startsWith('/sets/') && path.length > 6) {
        const id = path.split('/')[2];
        if (id) return { type: 'setDetail' as const, id };
    }
    if (path === '/sets') return { type: 'setGrid' as const, id: null };

    return { type: 'generic' as const, id: null };
}


export default function OfflineFallback() {
    const { type, id } = getRouteInfo();

    // Dashboard page
    if (type === 'dashboard') {
        return (
            <div className="flex min-h-screen flex-col">
                <DashboardClient />
            </div>
        );
    }

    // Cards page
    if (type === 'card' && id) {
        return <OfflineCardView cardId={id} />;
    }

    if (type === 'cardGrid') {
        return (
            <div className="flex flex-col min-h-screen">
                <CardPageView />
            </div>
        );
    }

    // Sets page
    if (type === 'setDetail' && id) {
        return <OfflineSetDetailView setId={id} />;
    }
    if (type === 'setGrid') {
        return <OfflineSetsView />;
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