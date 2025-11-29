'use client';

import { trpc } from '@/src/utils/trpc';
import { useAuthSession } from '@/src/providers/SessionProvider';
import { useEffect } from 'react';

export function CollectionDataInitializer() {
    const { data: session } = useAuthSession();

    // Prefetch collection ONLY if logged in
    const { refetch } = trpc.collection.getCollection.useQuery(undefined, {
        enabled: false // Don't run automatically on mount
    });

    useEffect(() => {
        if (session?.user) {
            refetch();
        }
    }, [session, refetch]);

    return null;
}
