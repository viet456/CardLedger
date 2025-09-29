'use client';

import { useRouter } from 'next/navigation';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useState } from 'react';
import { useDebounce } from '@/src/hooks/useDebounce';
import { trpc } from '@/src/utils/trpc';

interface HeaderSearchBarProps {
    onSuggestionClick?: () => void;
}

export function HeaderSearchBar({ onSuggestionClick }: HeaderSearchBarProps) {
    const searchTerm = useSearchStore((state) => state.filters.search);
    const setFilters = useSearchStore((state) => state.setFilters);

    const [isFocused, setIsFocused] = useState(false);
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const router = useRouter();

    const { data: suggestions, isLoading } = trpc.pokemonCard.getSuggestions.useQuery(
        { search: debouncedSearchTerm || '' },
        {
            enabled: !!debouncedSearchTerm && debouncedSearchTerm.length > 1
        }
    );
    const handleSubmit = (finalSearchTerm: string) => {
        setFilters({ search: finalSearchTerm });
        router.push(`/cards`);
        setIsFocused(false);
        if (onSuggestionClick) {
            onSuggestionClick();
        }
    };
    const handleBlur = () => {
        setTimeout(() => {
            setIsFocused(false);
        }, 150);
    };
    const handleClear = () => {
        setFilters({ search: '' });
    };

    return (
        <div className='relative w-full max-w-xs'>
            <input
                type='text'
                placeholder='Search for cards...'
                value={searchTerm || ''}
                onChange={(e) => setFilters({ search: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(searchTerm || '')}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                className='w-full rounded border bg-primary p-2 text-primary-foreground'
            />
            {searchTerm && (
                <button
                    onClick={handleClear}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-foreground'
                    aria-label='Clear search'
                >
                    ✕
                </button>
            )}
            {isLoading && <span className='absolute right-8 top-2 animate-spin'>🌀</span>}
            {isFocused && suggestions && suggestions.length > 0 && (
                <ul className='absolute z-10 mt-1 w-full rounded border bg-primary text-primary-foreground shadow-lg'>
                    {suggestions.map((card) => (
                        <li
                            key={card.id}
                            onClick={() => handleSubmit(card.name)}
                            className='cursor-pointer border-b p-2 hover:bg-accent hover:text-accent-foreground'
                        >
                            <div className='flex items-center justify-between'>
                                <div className='font-semibold'>{card.name}</div>
                                <div className='text-sm'>{card.setName}</div>
                            </div>
                        </li>
                    ))}
                    <li
                        onClick={() => handleSubmit(searchTerm || '')}
                        className='flex cursor-pointer items-center justify-between border-t p-2 text-center text-sm font-semibold hover:bg-accent hover:text-accent-foreground'
                    >
                        <span>Search for "{searchTerm}" 🔍</span>
                        <kbd className='ml-2 inline-flex items-center rounded border bg-muted px-2 py-1 font-sans text-xs text-muted-foreground'>
                            Enter ↵
                        </kbd>
                    </li>
                </ul>
            )}
        </div>
    );
}
