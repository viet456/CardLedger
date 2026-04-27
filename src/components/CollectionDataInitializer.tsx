'use client';

import { useAuthSession } from '@/src/providers/SessionProvider';
import { useEffect } from 'react';
import { useCollectionStore } from '../lib/store/collectionStore';

export function CollectionDataInitializer() {
    const { data: session } = useAuthSession();
    const initialize = useCollectionStore((state) => state.initialize);

    // Initialize collection
    useEffect(() => {
        if (session?.user?.id) {
            initialize(session.user.id);
        }
    }, [session?.user?.id, initialize]);

    // Real-time sync listener
    useEffect(() => {
        if (!session?.user?.id) return;

        // Note: Chrome blocks HTTP connections from HTTPS websites (Mixed Content).
        // For local development (http://localhost:3000), connecting to http://23.95.113.183:8080 works perfectly.
        // For production, switch to Nginx reverse proxy with SSL (eg https://sync.cardledger.io).
        const vpsUrl = `http://23.95.113.183:8080/stream?userId=${session.user.id}`;
        const eventSource = new EventSource(vpsUrl);

        // Debouncer
        let syncTimeout: NodeJS.Timeout;

        eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'SYNC_REQUIRED') {
                // Cancel the previous pull if another ping arrives instantly
                clearTimeout(syncTimeout);

                // Wait 150ms for the user to finish clicking, then pull once
                syncTimeout = setTimeout(() => {
                    // console.log('[SSE] Dust settled. Executing batched pull.');
                    useCollectionStore.getState().pullChanges();
                }, 150);
            }
        };

        eventSource.onerror = (error) => {
            //console.error('[SSE] Connection lost. Will auto-reconnect.', error);
            // The browser's native EventSource automatically tries to reconnect
        };

        return () => {
            // Clean up if user logs out
            clearTimeout(syncTimeout);
            eventSource.close(); 
        };
    }, [session?.user?.id]);

    return null;
}
