'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { useRef } from 'react';
import { Button } from '../ui/button';

export function SearchBar() {
    const { filters, setFilters } = useSearchStore();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters({ search: e.target.value });
    };
    const handleClear = () => {
        setFilters({ search: '' });
        inputRef.current?.focus();
    };

    return (
        <div className='relative w-full'>
            <input
                ref={inputRef}
                type='text'
                placeholder='Search for cards...'
                value={filters.search || ''}
                onChange={handleSearchChange}
                className='w-full rounded border bg-primary p-2 text-primary-foreground'
            />
            {filters.search && (
                <Button
                    onClick={handleClear}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-xl text-gray-400 hover:text-primary-foreground md:text-base'
                    aria-label='Clear search'
                >
                    ✕
                </Button>
            )}
        </div>
    );
}
