'use client';

import { useState, useMemo} from 'react';
import { Input } from '@/src/components/ui/input';
import { SetObject } from '@/src/shared-types/card-index';
import { SetCard } from '@/src/components/SetCard'; 
import { X, Search } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

interface SetClientProps {
    groupedSets: Record<string, SetObject[]>;
}

export function SetClient({ groupedSets }: SetClientProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter the grouped sets based on the search query
    const filteredGroups = useMemo(() => {
    return Object.entries(groupedSets).reduce((acc, [series, sets]) => {
        const matchedSets = sets.filter((set) =>
            set.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

            if (matchedSets.length > 0) {
                acc[series] = matchedSets;
            }
            return acc;
        }, {} as Record<string, SetObject[]>);
    }, [searchQuery, groupedSets]);

    const totalResults = Object.values(filteredGroups).flat().length;

    return (
        <div>
            <div className='mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
                <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>All Sets</h1>

                {/* Local Search Bar wrapped in a search landmark */}
                <form 
                    role="search" 
                    className='relative w-full sm:w-72'
                    onSubmit={(e) => e.preventDefault()}
                >
                    <Search className='absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' aria-hidden="true" />
                    <Input
                        className='h-10 pl-9 pr-8 bg-card rounded-lg border-border dark:border-white'
                        placeholder='Search sets...'
                        aria-label="Search Pokémon sets" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
    <Button
    type='button'
    variant='ghost'
    size='icon'
    onClick={() => setSearchQuery('')}
    aria-label='Clear search'
    className='absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 !hover:bg-transparent text-gray-400 hover:text-card-foreground transition-colors !shadow-none'
>
    <X className='h-4 w-4' />
</Button>
)}
                </form>
            </div>

            {/* Visually hidden but read by screen readers when results change */}
            <div className="sr-only" aria-live="polite">
                {searchQuery ? `${totalResults} sets found for ${searchQuery}` : ''}
            </div>

            <div className='space-y-8'>
                {Object.keys(filteredGroups).length === 0 ? (
                    <p role="status" className='text-muted-foreground mt-8'>
                        {`No sets found matching "${searchQuery}"`}
                    </p>
                ) : (
                    Object.keys(filteredGroups).map((series, seriesIndex) => (
                        <section key={series} aria-labelledby={`heading-${series}`}>
                            <h2 
                                id={`heading-${series}`}
                                className='mb-4 border-b pb-2 text-2xl font-semibold'
                            >
                                {series}
                            </h2>
                            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                                {filteredGroups[series].map((set: SetObject, setIndex: number) => {
                                    const isPriority = !searchQuery && seriesIndex < 2 && setIndex < 5;
                                    return <SetCard key={set.id} set={set} isPriority={isPriority} />;
                                })}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </div>
    );
}