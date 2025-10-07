'use client';

import { CardDataInitializer } from '@/src/components/CardDataInitializer';
import { useCardStore } from '@/src/lib/store/cardStore';
import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { SetObject } from '@/src/shared-types/card-index';
import { useMemo } from 'react';

export default function SetsPage() {
    const { sets, status } = useCardStore();

    const groupedSets = useMemo(() => {
        if (!sets || sets.length === 0) return {};
        // Sort sets within each group by release date descending
        const sortedSets = [...sets].sort(
            (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
        );
        return sortedSets.reduce((acc: Record<string, SetObject[]>, set) => {
            const series = set.series;
            if (!acc[series]) {
                acc[series] = [];
            }
            acc[series].push(set);
            return acc;
        }, {});
    }, [sets]);

    return (
        <div className='container mx-auto p-4 sm:p-6 lg:p-8'>
            <CardDataInitializer />
            <h1 className='mb-6 text-3xl font-bold tracking-tight md:text-4xl'>All Sets</h1>

            {!status.startsWith('ready') ? (
                <p>Loading sets...</p>
            ) : (
                <div className='space-y-8'>
                    {Object.keys(groupedSets).map((series) => (
                        <div key={series}>
                            <h2 className='mb-4 border-b pb-2 text-2xl font-semibold'>{series}</h2>
                            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                                {groupedSets[series].map((set) => (
                                    <Link
                                        href={`/sets/${set.id}`}
                                        key={set.id}
                                        className='hover:bg-muted/50 group flex flex-col items-center justify-between rounded-lg border bg-card p-4 text-card-foreground transition-colors'
                                    >
                                        {/* Header */}
                                        <div className='flex w-full flex-col items-center text-center'>
                                            <div className='mb-2 flex items-center justify-center gap-2'>
                                                {set.symbolImageKey && (
                                                    <CldImage
                                                        src={set.symbolImageKey}
                                                        alt={`${set.name} symbol`}
                                                        width={30}
                                                        height={30}
                                                        className='object-contain'
                                                    />
                                                )}
                                                <p className='text-md font-semibold'>{set.name}</p>
                                                {set.ptcgoCode && (
                                                    <span className='rounded bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground'>
                                                        {set.ptcgoCode}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Logo + Date */}
                                        <div className='flex w-full flex-col items-center justify-center'>
                                            <div className='relative flex aspect-[2/1] w-full items-center justify-center'>
                                                {set.logoImageKey ? (
                                                    <CldImage
                                                        src={set.logoImageKey}
                                                        alt={`${set.name} logo`}
                                                        fill
                                                        className='object-contain transition-transform group-hover:scale-110'
                                                    />
                                                ) : (
                                                    <div className='bg-muted/50 flex h-full w-full items-center justify-center rounded-sm text-xs text-muted-foreground'>
                                                        No Logo
                                                    </div>
                                                )}
                                            </div>
                                            <span className='mt-2 text-sm text-muted-foreground'>
                                                {set.releaseDate}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
