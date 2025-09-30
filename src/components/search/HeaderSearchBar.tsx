'use client';

import { useRouter } from 'next/navigation';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/src/hooks/useDebounce';
import { trpc } from '@/src/utils/trpc';
import { useClickOutside } from '@/src/hooks/useClickOutside';

interface HeaderSearchBarProps {
    onSuggestionClick: () => void;
}

export function HeaderSearchBar({ onSuggestionClick }: HeaderSearchBarProps) {
    const router = useRouter();
    const { filters, setFilters } = useSearchStore();

    const [inputValue, setInputValue] = useState(filters.search);

    useEffect(() => {
        setInputValue(filters.search);
    }, [filters.search]);

    const debouncedSearchTerm = useDebounce(inputValue, 300);

    const [isFocused, setIsFocused] = useState(false);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    useClickOutside(searchContainerRef, () => setIsFocused(false));

    const { data: suggestions, isLoading } = trpc.pokemonCard.getSuggestions.useQuery(
        { search: debouncedSearchTerm || '' },
        {
            enabled: !!debouncedSearchTerm && debouncedSearchTerm.length > 1
        }
    );
    const handleSubmit = (finalSearchTerm: string, setId?: string, cardNumber?: string) => {
        console.log('handleSubmit called with:', { finalSearchTerm, setId, cardNumber });
        setIsFocused(false);
        setFilters({ search: finalSearchTerm });

        if (setId) {
            setFilters({ search: '' });
            router.push(`/cards/${setId}/${cardNumber}`);
        } else {
            setFilters({ search: finalSearchTerm });
            router.push(`/cards`);
        }
        onSuggestionClick();
    };
    const handleClear = () => {
        setIsFocused(false);
        setInputValue('');
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (suggestions && suggestions.length === 1) {
                handleSubmit(suggestions[0].name, suggestions[0].setId, suggestions[0].number);
            } else {
                handleSubmit(inputValue || '');
            }
        }
    };

    return (
        <div ref={searchContainerRef} className='relative w-full'>
            <label htmlFor='header-search' className='sr-only'>
                Search for Pokémon cards
            </label>
            <input
                id='header-search'
                type='text'
                placeholder='Search for cards...'
                value={inputValue || ''}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    setFilters({ search: e.target.value });
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                autoComplete='off'
                className='w-full rounded border bg-primary p-2 text-primary-foreground'
            />
            {inputValue && (
                <button
                    onClick={handleClear}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-xl text-gray-400 hover:text-primary-foreground md:text-base'
                    aria-label='Clear search'
                >
                    ✕
                </button>
            )}
            {isLoading && <span className='absolute right-8 top-2 animate-spin'>🌀</span>}
            {isFocused && suggestions && suggestions.length > 0 && (
                <ul
                    role='listbox'
                    className='absolute z-10 mt-1 w-full rounded border bg-primary text-primary-foreground shadow-lg'
                >
                    {suggestions.map((card) => (
                        <li
                            key={card.id}
                            role='option'
                            aria-selected='false'
                            onClick={() => handleSubmit(card.name, card.setId, card.number)}
                            className='flex cursor-pointer justify-between border-b p-3 hover:bg-accent hover:text-accent-foreground'
                        >
                            <div className='flex flex-col'>
                                <div className='text-sm font-bold md:text-base'>{card.name}</div>
                                <div className='text-sm md:text-base'>
                                    {card.number}/{card.printedTotal}
                                </div>
                            </div>
                            <div className='flex flex-col items-end'>
                                <div className='text-right text-sm md:text-base'>
                                    {card.setName}
                                </div>
                                <div className='text-left text-xs md:text-sm'>{card.id}</div>
                            </div>
                        </li>
                    ))}
                    {suggestions && suggestions.length === 1 ? (
                        // on one suggestion, suggest to go to card page
                        <li
                            onClick={() =>
                                handleSubmit(
                                    suggestions[0].name,
                                    suggestions[0].setId,
                                    suggestions[0].number
                                )
                            }
                            className='group flex cursor-pointer items-center justify-between border-t p-3 text-center text-xs font-semibold hover:bg-accent hover:text-accent-foreground md:text-sm'
                        >
                            <span>
                                Go to <span className='font-bold'>{suggestions[0].name}</span>
                            </span>
                            <kbd className='ml-2 inline-flex items-center rounded border bg-accent px-2 py-1 font-sans text-xs text-accent-foreground group-hover:bg-accent-foreground group-hover:text-accent md:text-sm'>
                                Enter ↵
                            </kbd>
                        </li>
                    ) : (
                        // on multiple suggestions, suggest to go to search page
                        <li
                            onClick={() => handleSubmit(inputValue || '')}
                            className='group flex cursor-pointer items-center justify-between border-t p-3 text-center text-xs font-semibold hover:bg-accent hover:text-accent-foreground md:text-sm'
                        >
                            <span>
                                {' '}
                                Search for 🔍 "<span className='font-bold'>{inputValue}</span>"{' '}
                            </span>
                            <kbd className='ml-2 inline-flex items-center rounded border bg-accent px-2 py-1 font-sans text-xs text-accent-foreground group-hover:bg-accent-foreground group-hover:text-accent md:text-sm'>
                                Enter ↵
                            </kbd>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
