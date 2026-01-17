'use client';

import { useMemo, useEffect } from 'react';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { CollectionPageView } from './CollectionPageView';
import { PortfolioView } from './PortfolioView';
import { DashboardSkeleton } from './DashboardSkeleton';
import { mapPrismaCardToDenormalized } from '@/src/utils/cardMapper';
import { RichCollectionEntry } from '@/src/shared-types/collection-types';
import { useAuthSession } from '@/src/providers/SessionProvider';
import { useRouter } from 'next/navigation';
import { trpc } from '@/src/utils/trpc';

function toNum(val: any): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (val && typeof val.toNumber === 'function') return val.toNumber();
    return Number(val);
}

export function DashboardClient() {
    const router = useRouter();
    const { data: session, isPending: isAuthPending } = useAuthSession();

    useEffect(() => {
        if (!isAuthPending && !session) {
            router.push('/sign-in');
        }
    }, [session, isAuthPending, router]);

    const entries = useCollectionStore(
        (state) => state.entries
    ) as unknown as RichCollectionEntry[];
    const status = useCollectionStore((state) => state.status);

    // Fetch portfolio price history if logged in
    const { data: portfolioHistory } = trpc.collection.getPortfolioHistory.useQuery(undefined, {
        enabled: !!session?.user
    });

    const gridCards = useMemo(() => {
        return entries
            .filter((entry) => entry.card && entry.card.set)
            .map((entry) => ({
                ...mapPrismaCardToDenormalized(entry.card),
                uniqueId: entry.id,
                collectionStats: {
                    cost: Number(entry.purchasePrice), // Safe cast
                    acquiredAt: new Date(entry.createdAt),
                    condition: entry.condition
                }
            }));
    }, [entries]);

    const serializedEntries = useMemo(() => {
        return entries
            .filter((entry) => entry.card && entry.card.set)
            .map((entry) => ({
                ...entry,
                purchasePrice: Number(entry.purchasePrice),
                card: {
                    ...entry.card,
                    marketStats: entry.card.marketStats
                        ? {
                              ...entry.card.marketStats,
                              tcgNearMintLatest: toNum(entry.card.marketStats.tcgNearMintLatest),
                              tcgLightlyPlayedLatest: toNum(
                                  entry.card.marketStats.tcgLightlyPlayedLatest
                              ),
                              tcgModeratelyPlayedLatest: toNum(
                                  entry.card.marketStats.tcgModeratelyPlayedLatest
                              ),
                              tcgHeavilyPlayedLatest: toNum(
                                  entry.card.marketStats.tcgHeavilyPlayedLatest
                              ),
                              tcgDamagedLatest: toNum(entry.card.marketStats.tcgDamagedLatest)
                          }
                        : null
                }
            }));
    }, [entries]);

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
