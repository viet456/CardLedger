'use client';

import { useCardStore } from '@/src/lib/store/cardStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useMemo } from 'react';
import { SetObject } from '@/src/shared-types/card-index';
import { WifiOff } from 'lucide-react';
import { SetClient, GroupedSet } from '../sets/SetClient';

export function OfflineSetsView() {
    const hasHydrated = useHasHydrated();
    const sets = useCardStore((state) => state.sets);

    // Group the flat array by series, just like the server does
    const groupedSets = useMemo(() => {
        if (!sets) return [];
        
        const seriesMap = new Map<string, SetObject[]>();
        for (const set of sets) {
            if (!seriesMap.has(set.series)) {
                seriesMap.set(set.series, []);
            }
            seriesMap.get(set.series)!.push(set);
        }

        const grouped = Array.from(seriesMap.entries()).map(([series, groupSets]) => {
            // groupSets is already sorted newest first, so the oldest set is at the end
            const oldestSet = groupSets[groupSets.length - 1];
            return {
                series,
                sets: groupSets,
                _startDate: new Date(oldestSet.releaseDate).getTime()
            };
        });

        grouped.sort((a, b) => b._startDate - a._startDate);

        return grouped.map(({ _startDate, ...rest }) => rest) as GroupedSet[];
    }, [sets]);

    if (!hasHydrated) {
        return <div className="p-8 animate-pulse bg-muted min-h-screen" />; 
    }

    if (!sets || sets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-12 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold">No Sets Found Locally</h2>
            </div>
        );
    }

    return (
        <main className='container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8'>
            <SetClient groupedSets={groupedSets} />
        </main>
    );
}