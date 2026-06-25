import { prisma } from '@/src/lib/prisma';
import { SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import { type Set as PrismaSet } from '@prisma/client';
import { SetClient, GroupedSet } from './SetClient';

export const metadata: Metadata = {
    title: 'All Sets | CardLedger',
    description: 'Browse a complete list of all Pokémon TCG sets, grouped by series.'
};

async function getCachedGroupedSets() {
    'use cache';
    cacheLife('days');
    cacheTag('all-sets'); // Tag for manual invalidation
    const allSets = await prisma.set.findMany({
        orderBy: {
            releaseDate: 'desc'
        }
    });
    
    const seriesMap = new Map<string, PrismaSet[]>();
    for (const set of allSets) {
        const series = set.series;
        if (!seriesMap.has(series)) {
            seriesMap.set(series, []);
        }
        seriesMap.get(series)!.push(set);
    }

    const grouped = Array.from(seriesMap.entries()).map(([series, sets]) => {
        const mappedSets = sets.map(set => ({
            ...set,
            releaseDate: set.releaseDate.toISOString().split('T')[0]
        }));
        
        // Use the oldest set in the series to represent its chronological starting point
        const oldestSet = sets[sets.length - 1];
        
        return {
            series,
            sets: mappedSets,
            _startDate: oldestSet.releaseDate.getTime() // Temporary field for sorting
        };
    });

    // Sort series by newest starting date first
    grouped.sort((a, b) => b._startDate - a._startDate);

    // Remove the temporary sorting field
    return grouped.map(({ _startDate, ...rest }) => rest) as GroupedSet[];
}

export default async function SetsPage() {
    const groupedSets = await getCachedGroupedSets();

    return (
        <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
            <SetClient groupedSets={groupedSets} />
        </div>
    );
}
