import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/src/lib/prisma';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { CollectionPageView } from './_components/CollectionPageView';
import { mapPrismaCardToDenormalized } from '@/src/utils/cardMapper';
import { Suspense } from 'react';
import { DashboardSkeleton } from './_components/DashboardSkeleton';

async function DashboardContent() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect('/sign-in');
    }

    const collectionEntries = await prisma.collectionEntry.findMany({
        where: { userId: session.user.id },
        include: {
            card: {
                include: {
                    set: true,
                    rarity: true,
                    marketStats: true,
                    artist: true,
                    types: { include: { type: true } },
                    subtypes: { include: { subtype: true } },
                    weaknesses: { include: { type: true } },
                    resistances: { include: { type: true } }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const gridCards =
        collectionEntries?.map((entry) => ({
            ...mapPrismaCardToDenormalized(entry.card),
            uniqueId: entry.id
        })) || [];

    return (
        <main className='mx-auto flex min-h-screen w-full flex-col space-y-4 p-6 text-foreground'>
            <h1 className='text-2xl font-bold'>Dashboard</h1>
            <p>Welcome back, {session.user.name || session.user.username || 'Collector'}</p>
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

export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
        </Suspense>
    );
}
