'use client';

import { useMemo, useEffect } from 'react';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { CollectionPageView } from './CollectionPageView';
import { PortfolioView } from './PortfolioView';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useAuthSession } from '@/src/providers/SessionProvider';
import { useRouter } from 'next/navigation';
import { trpc } from '@/src/utils/trpc';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useShallow } from 'zustand/react/shallow';
import { denormalizeSingleCard } from '@/src/utils/cardUtils';

export function DashboardClient() {
    const router = useRouter();
    const { data: session, isPending: isAuthPending } = useAuthSession();

    useEffect(() => {
        if (!isAuthPending && !session) {
            router.push('/sign-in');
        }
    }, [session, isAuthPending, router]);

    const initialize = useCollectionStore((state) => state.initialize);
    const entries = useCollectionStore((state) => state.entries);
    const status = useCollectionStore((state) => state.status);

    useEffect(() => {
        if (session?.user?.id) {
            initialize(session.user.id);
        }
    }, [session?.user?.id, initialize]);

    const { data: portfolioHistory } = trpc.collection.getPortfolioHistory.useQuery(undefined, {
        enabled: !!session?.user
    });

    // Subscribe to 21k Local Database & Market Data
    const cardMap = useCardStore((state) => state.cardMap);
    const lookups = useCardStore(
        useShallow((state) => ({
            artists: state.artists,
            rarities: state.rarities,
            sets: state.sets,
            types: state.types,
            subtypes: state.subtypes,
            supertypes: state.supertypes,
            abilities: state.abilities,
            attacks: state.attacks,
            rules: state.rules
        }))
    );
    const prices = useMarketStore((state) => state.prices);

    // Instant client-side join
    const { gridCards, serializedEntries } = useMemo(() => {
        const mappedGridCards = [];
        const mappedTableEntries = [];

        for (const entry of entries) {
            // Find the card in our 21k local database
            const localCard = cardMap.get(entry.cardId);
            if (!localCard) continue;

            // Denormalize the raw card into a rich UI object
            const denormalized = denormalizeSingleCard(localCard, lookups, prices);

            // Build the card for the Grid (CollectionPageView)
            mappedGridCards.push({
                ...denormalized,
                uniqueId: entry.id,
                collectionStats: {
                    cost: Number(entry.purchasePrice),
                    // Safely handle createdAt whether it's a Date or string from TRPC
                    acquiredAt: new Date(entry.createdAt),
                    variant: entry.variant || 'Normal'
                }
            });

            // Build the slim payload for the Table (PortfolioView)
            mappedTableEntries.push({
                id: entry.id,
                cardId: entry.cardId,
                purchasePrice: Number(entry.purchasePrice),
                createdAt: entry.createdAt,
                variant: entry.variant,
                card: {
                    name: localCard.n,
                    imageKey: localCard.img ?? '',
                    set: { name: lookups.sets[localCard.s].name },
                    variants: denormalized.variants || null
                }
            });
        }

        return { gridCards: mappedGridCards, serializedEntries: mappedTableEntries };
    }, [entries, cardMap, lookups, prices]);

    const isLoading = status === 'loading' || status === 'idle';
    const hasData = entries.length > 0;

    if (isLoading && !hasData) {
        return <DashboardSkeleton />;
    }

    if (!isAuthPending && !session) return null;

    return (
        <main className='mx-auto mb-16 flex min-h-screen w-full flex-col p-4 text-foreground lg:p-8'>
            <Tabs defaultValue='gallery' className='w-full'>
                <div className='flex items-center justify-between'>
                    <TabsList className='rounded-lg bg-muted p-1'>
                        <TabsTrigger value='gallery'>Gallery View</TabsTrigger>
                        <TabsTrigger value='portfolio'>Portfolio</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value='gallery' className='mt-6 flex-grow'>
                    {gridCards.length === 0 ? (
                        <div className='flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-border'>
                            <p className='text-muted-foreground'>Your collection is empty.</p>
                            <p className='text-sm text-muted-foreground'>Go add some cards!</p>
                        </div>
                    ) : (
                        <CollectionPageView cards={gridCards} />
                    )}
                </TabsContent>

                <TabsContent value='portfolio' className='mt-6'>
                    <PortfolioView history={portfolioHistory || []} entries={serializedEntries} />
                </TabsContent>
            </Tabs>
        </main>
    );
}
