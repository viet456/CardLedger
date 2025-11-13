'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { useRef, useEffect } from 'react';
import { Button } from '../ui/button';

export function SearchBar() {
    const { filters, setFilters } = useSearchStore();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for '/' key
            if (event.key === '/') {
                // Prevent the '/' from being typed if the user is not
                // already in an input field (like a textarea)
                const target = event.target as HTMLElement;
                if (
                    target.tagName !== 'INPUT' &&
                    target.tagName !== 'TEXTAREA' &&
                    !target.isContentEditable
                ) {
                    event.preventDefault();
                    inputRef.current?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && document.activeElement === inputRef.current) {
                inputRef.current?.blur(); // Blur the input
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Cleanup the event listener on component unmount
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [setFilters]);

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
                className='h-10 w-full rounded border bg-primary p-2 text-primary-foreground'
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
