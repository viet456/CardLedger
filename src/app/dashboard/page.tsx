'use client';
import { useRouter } from 'next/navigation';
import { useSession } from '@/src/lib/auth-client';
import { useEffect } from 'react';
import { trpc } from '@/src/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { CollectionPageView } from './_components/CollectionPageView';
import { mapPrismaCardToDenormalized } from '@/src/utils/cardMapper';

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending } = useSession();
    // Fetch data
    // automatically uses 'ctx.user.id' if no userId is provided
    const { data: collectionEntries, isLoading: isCollectionLoading } =
        trpc.collection.getCollection.useQuery(
            //{ userId: session?.user?.id || '' },
            undefined,
            { enabled: !!session?.user?.id }
        );
    // Auth redirect
    useEffect(() => {
        if (!isPending && !session?.user) {
            router.push('/sign-in');
        }
    }, [isPending, session, router]);
    // Loading state
    if (isPending || isCollectionLoading)
        return <p className='mt-8 text-center text-foreground'>Loading...</p>;
    if (!session?.user) return <p className='mt-8 text-center text-foreground'>Redirecting...</p>;

    const { user } = session;

    const gridCards =
        collectionEntries?.map((entry) => ({
            ...mapPrismaCardToDenormalized(entry.card),
            uniqueId: entry.id
        })) || [];
    return (
        <main className='mx-auto flex min-h-screen w-full flex-col space-y-4 p-6 text-foreground'>
            <h1 className='text-2xl font-bold'>Dashboard</h1>
            <p>Welcome back, {user.name || user.username || 'Collector'}</p>
            <Tabs defaultValue='gallery' className='w-full'>
                <div className='flex items-center justify-between'>
                    <TabsList className='rounded-lg bg-muted p-1'>
                        <TabsTrigger value='gallery'>Gallery View</TabsTrigger>
                        <TabsTrigger value='ledger' disabled className='opacity-50'>
                            Ledger (coming soon)
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value='gallery' className='mt-6 flex-grow'>
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
