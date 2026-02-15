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
import { CardPrices } from '@/src/shared-types/price-api';

function toNum(val: any): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    // Check if it's a Prisma Decimal or similar object with a toNumber method
    if (val && typeof val === 'object' && 'toNumber' in val && typeof val.toNumber === 'function') {
        return val.toNumber();
    }
    
    const num = Number(val);
    return isNaN(num) ? null : num;
}

export function DashboardClient() {
    const router = useRouter();
    const { data: session, isPending: isAuthPending } = useAuthSession();

    useEffect(() => {
        if (!isAuthPending && !session) {
            router.push('/sign-in');
        }
    }, [session, isAuthPending, router]);

    const setEntries = useCollectionStore((state) => state.setEntries);
    const entries = useCollectionStore(
        (state) => state.entries
    ) as unknown as RichCollectionEntry[];
    const status = useCollectionStore((state) => state.status);

    const { data: collectionData } = trpc.collection.getCollection.useQuery(undefined, {
        enabled: !!session?.user
    });

    useEffect(() => {
        if (collectionData?.entries) {
            setEntries(collectionData.entries);
        }
    }, [collectionData, setEntries]);

    // Fetch portfolio price history if logged in
    const { data: portfolioHistory } = trpc.collection.getPortfolioHistory.useQuery(undefined, {
        enabled: !!session?.user
    });
    
    const gridCards = useMemo(() => {
        return entries
            .filter((entry) => entry.card && entry.card.set)
            .map((entry) => {
                // Extract and map variants
                const s = entry.card.marketStats;
                const variants = s ? {
                    tcgNearMint: toNum(s.tcgNearMintLatest),
                    tcgNormal: toNum(s.tcgNormalLatest),
                    tcgHolo: toNum(s.tcgHoloLatest),
                    tcgReverse: toNum(s.tcgReverseLatest),
                    tcgFirstEdition: toNum(s.tcgFirstEditionLatest),
                } : null;

                // Return the card with variants attached
                return {
                    ...mapPrismaCardToDenormalized(entry.card),
                    uniqueId: entry.id,
                    variants: variants, 
                    collectionStats: {
                        cost: Number(entry.purchasePrice),
                        acquiredAt: new Date(entry.createdAt),
                        variant: entry.variant
                    }
                };
            });
    }, [entries]);

    const serializedEntries = useMemo(() => {
        return entries
            .filter((entry) => entry.card && entry.card.set)
            .map((entry) => {
                // Transform raw marketStats to the 'variants' object
                const s = entry.card.marketStats;
                const variants: CardPrices | null = s ? {
                     tcgNearMint: toNum(s.tcgNearMintLatest),
                     tcgNormal: toNum(s.tcgNormalLatest),
                     tcgHolo: toNum(s.tcgHoloLatest),
                     tcgReverse: toNum(s.tcgReverseLatest),
                     tcgFirstEdition: toNum(s.tcgFirstEditionLatest),
                } : null;

                return {
                    id: entry.id,
                    cardId: entry.cardId,
                    purchasePrice: Number(entry.purchasePrice),
                    createdAt: entry.createdAt,
                    variant: entry.variant,
                    card: {
                        name: entry.card.name,
                        imageKey: entry.card.imageKey ?? '', 
                        set: {
                            name: entry.card.set.name
                        },
                        variants: variants
                    }
                };
            });
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
