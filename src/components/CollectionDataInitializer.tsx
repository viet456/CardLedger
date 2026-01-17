'use client';

import { useAuthSession } from '@/src/providers/SessionProvider';
import { useEffect } from 'react';
import { useCollectionStore } from '../lib/store/collectionStore';

export function CollectionDataInitializer() {
    const { data: session } = useAuthSession();
    const initialize = useCollectionStore((state) => state.initialize);

    useEffect(() => {
        if (session?.user?.id) {
            initialize(session.user.id);
        }
    }, [session?.user?.id, initialize]);

    return null;
}
