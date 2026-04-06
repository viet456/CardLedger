import { prisma } from '@/src/lib/prisma';
import { SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';
import { cacheLife, cacheTag } from 'next/cache';
import { type Set as PrismaSet } from '@prisma/client';
import { SetClient } from './SetClient';

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
    return allSets.reduce((acc: Record<string, SetObject[]>, set: PrismaSet) => {
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
    const groupedSets = await getCachedGroupedSets();

    return (
        <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
            <SetClient groupedSets={groupedSets} />
        </div>
    );
}
