'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { useState, useEffect } from 'react';

export function SearchBar() {
    const globalSearchTerm = useSearchStore((state) => state.filters.search);
    const setGlobalFilters = useSearchStore((state) => state.setFilters);

    // local state for instant typing experience
    const [inputValue, setInputValue] = useState(globalSearchTerm || '');

    // debounce the input for updating global store
    useEffect(() => {
        const timer = setTimeout(() => {
            setGlobalFilters({ search: inputValue });
        }, 200);
        return () => {
            clearTimeout(timer);
        };
    }, [inputValue, setGlobalFilters]);

    // sync local search bar with global search state
    useEffect(() => {
        setInputValue(globalSearchTerm || '');
    }, [globalSearchTerm]);

    return (
        <>
            <input
                type='text'
                placeholder='Search for cards...'
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className='w-full rounded border bg-primary p-2 text-primary-foreground'
            />
        </>
    );
}
