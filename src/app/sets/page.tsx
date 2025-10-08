import { PrismaClient } from '@prisma/client';
import { SetObject } from '@/src/shared-types/card-index';
import { SetCard } from '@/src/components/SetCard';

const prisma = new PrismaClient();

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
    return (
        <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
            <h1 className='mb-6 text-3xl font-bold tracking-tight md:text-4xl'>All Sets</h1>
            <div className='space-y-8'>
                {Object.keys(groupedSets).map((series) => (
                    <div key={series}>
                        <h2 className='mb-4 border-b pb-2 text-2xl font-semibold'>{series}</h2>
                        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                            {groupedSets[series].map((set) => (
                                <SetCard key={set.id} set={set} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
