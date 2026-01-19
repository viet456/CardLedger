'use client';

import { useRouter } from 'next/navigation';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { trpc } from '@/src/utils/trpc';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface HeaderSearchBarProps {
    onSuggestionClick: () => void;
}

export function HeaderSearchBar({ onSuggestionClick }: HeaderSearchBarProps) {
    const router = useRouter();
    const { setFilters } = useSearchStore();

    const [inputValue, setInputValue] = useState('');

    const debouncedSearchTerm = useDebounce(inputValue, 300);

    const [isFocused, setIsFocused] = useState(false);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    useClickOutside(searchContainerRef, () => setIsFocused(false));
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFocused(false); // Close suggestions
                inputRef.current?.blur();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const { data: suggestions, isLoading } = trpc.pokemonCard.getSuggestions.useQuery(
        { search: debouncedSearchTerm || '' },
        {
            enabled: !!debouncedSearchTerm && debouncedSearchTerm.length > 1
        }
    );
    const handleSubmit = (searchTerm: string, cardId?: string) => {
        setIsFocused(false);
        onSuggestionClick();
        if (cardId) {
            setFilters({ search: '' });
            setInputValue('');
            router.push(`/cards/${cardId}`);
        } else {
            const params = new URLSearchParams();
            if (searchTerm) {
                params.set('search', searchTerm);
            }
            router.push(`/cards?${params.toString()}&sortBy=relevance&sortOrder=desc`);
        }
    };
    const handleClear = () => {
        setIsFocused(false);
        setFilters({ search: '' });
        setInputValue('');
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (suggestions && suggestions.length === 1) {
                handleSubmit(suggestions[0].name, suggestions[0].id);
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
                ref={inputRef}
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
                className='h-9 w-full rounded border border-border bg-card p-2 pr-10 text-card-foreground'
            />
            {inputValue && (
                <Button
                    variant='ghost'
                    size='icon'
                    onClick={handleClear}
                    className='absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400 hover:text-card-foreground'
                    aria-label='Clear search'
                >
                    <X className='h-3 w-3' />
                </Button>
            )}
            {isLoading && <span className='absolute right-10 top-2 animate-spin'>🌀</span>}

            {isFocused && suggestions && suggestions.length > 0 && (
                <ul
                    role='listbox'
                    className='absolute z-10 m-0 mt-1 w-full list-none rounded border bg-card p-0 text-card-foreground shadow-lg'
                >
                    {suggestions.map((card) => (
                        <li
                            key={card.id}
                            role='option'
                            aria-selected='false'
                            onClick={() => handleSubmit(card.name, card.id)}
                            className='m-0 flex cursor-pointer justify-between border-b px-4 py-2 hover:bg-accent hover:text-accent-foreground'
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
                        <li
                            onClick={() => handleSubmit(suggestions[0].name, suggestions[0].id)}
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
                        <li
                            onClick={() => handleSubmit(inputValue || '')}
                            className='group m-0 flex cursor-pointer items-center justify-between border-t p-3 text-center text-xs font-semibold hover:bg-accent hover:text-accent-foreground md:text-sm'
                        >
                            <span>
                                {' '}
                                Search for 🔍 &quot<span className='font-bold'>{inputValue}</span>
                                &quot{' '}
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
