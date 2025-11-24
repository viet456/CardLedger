'use client';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/src/lib/auth-client';
import { useEffect } from 'react';
import { trpc } from '@/src/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { CollectionPageView } from './components/CollectionPageView';

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending } = useSession();
    const { data: collectionEntries, isLoading: isCollectionLoading } =
        trpc.collection.getCollection.useQuery(
            { userId: session?.user?.id || '' },
            { enabled: !!session?.user?.id }
        );

    useEffect(() => {
        if (!isPending && !session?.user) {
            router.push('/sign-in');
        }
    }, [isPending, session, router]);

    if (isPending || isCollectionLoading)
        return <p className='mt-8 text-center text-foreground'>Loading...</p>;
    if (!session?.user) return <p className='mt-8 text-center text-foreground'>Redirecting...</p>;

    const { user } = session;

    // Fetch the collection

    const gridCards =
        collectionEntries?.map((entry) => ({
            id: entry.card.id,
            n: entry.card.name,
            img: entry.card.imageKey || '',
            set: {
                name: entry.card.set.name,
                printedTotal: entry.card.set.printedTotal,
                id: entry.card.set.id,
                series: entry.card.set.series,
                releaseDate: entry.card.set.releaseDate,
                ptcgoCode: entry.card.set.ptcgoCode
            },
            rarity: entry.card.rarity?.name || 'Unknown',
            artist: entry.card.artist?.name || 'Unknown',
            num: entry.card.number,
            price: Number(entry.card.marketStats?.tcgNearMintLatest) || 0,

            hp: entry.card.hp,
            supertype: entry.card.supertype,
            pS: entry.card.pokedexNumberSort,
            cRC: entry.card.convertedRetreatCost,
            types: entry.card.types.map((t) => t.type.name),
            subtypes: entry.card.subtypes.map((s) => s.subtype.name),
            weaknesses: entry.card.weaknesses.map((w) => ({
                type: w.type.name,
                value: w.value
            })),
            resistances: entry.card.resistances.map((r) => ({
                type: r.type.name,
                value: r.value
            })),
            attacks: [],
            abilities: [],
            rules: [],
            evolvesFrom: null,
            evolvesTo: [],
            legalities: {
                standard: entry.card.standard,
                expanded: entry.card.expanded,
                unlimited: entry.card.unlimited
            },
            pokedexNumbers: entry.card.nationalPokedexNumbers,
            ancientTrait: null
        })) || [];

    return (
        <main className='mx-auto flex h-screen max-w-md flex-col items-center space-y-4 p-6 text-foreground'>
            <h1 className='text-2xl font-bold'>Dashboard</h1>
            <p>Welcome, {user.username || 'User'}!</p>
            <Tabs defaultValue='gallery' className='w-full'>
                <div className='flex items-center justify-between'>
                    <TabsList>
                        <TabsTrigger value='gallery'>Gallery View</TabsTrigger>
                        <TabsTrigger value='ledger' disabled className='opacity-50'>
                            Ledger (coming soon)
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value='gallery' className='mt-6'>
                    {gridCards.length === 0 ? (
                        <div className='flex h-64 flex-col items-center justify-center rounded-md border border-dashed border-border'>
                            <p>Your collection is empty.</p>
                            <p>Go add some cards!</p>
                        </div>
                    ) : (
                        <CollectionPageView cards={gridCards} />
                    )}
                </TabsContent>
            </Tabs>
        </main>
    );
}
