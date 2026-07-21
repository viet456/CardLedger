import { NextResponse } from 'next/server';
import { cacheLife } from 'next/cache';
import { prisma } from '@/src/lib/prisma';

async function getCachedSetIds() {
    'use cache';
    cacheLife('weeks');

    const sets = await prisma.set.findMany({
        select: { id: true },
        orderBy: { releaseDate: 'desc' }
    });

    return sets.map((s) => s.id);
}

export async function GET() {
    const setIds = await getCachedSetIds();

    return NextResponse.json(
        { setIds },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
            }
        }
    );
}