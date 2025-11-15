import { prisma } from '@/src/lib/prisma';
import { SetObject } from '@/src/shared-types/card-index';
import { SetCard } from '@/src/components/SetCard';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'All Sets | CardLedger',
    description: 'Browse a complete list of all Pokémon TCG sets, grouped by series.'
};
export const revalidate = 86400; // requires regeneration daily

async function getGroupedSets() {
    const allSets = await prisma.set.findMany({
        orderBy: {
            releaseDate: 'desc'
        }
    });
    return allSets.reduce((acc: Record<string, SetObject[]>, set) => {
        const series = set.series;
        if (!acc[series]) {
            acc[series] = [];
        }
        acc[series].push({
            ...set,
            releaseDate: set.releaseDate.toISOString().split('T')[0]
        });
        return acc;
    }, {});
}

export default async function SetsPage() {
    const groupedSets = await getGroupedSets();
    const prioritySetCount = 5;

    return (
        <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
            <h1 className='mb-6 text-3xl font-bold tracking-tight md:text-4xl'>All Sets</h1>
            <div className='space-y-8'>
                {Object.keys(groupedSets).map((series, seriesIndex) => (
                    <div key={series}>
                        <h2 className='mb-4 border-b pb-2 text-2xl font-semibold'>{series}</h2>
                        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                            {groupedSets[series].map((set, setIndex) => {
                                const isPriority = seriesIndex < 2 && setIndex < prioritySetCount;
                                return <SetCard key={set.id} set={set} isPriority={isPriority} />;
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
