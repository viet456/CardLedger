'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

export function SearchBar() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [value, setValue] = useState(searchParams.get('search') || '');
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
                inputRef.current?.blur();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);

        const params = new URLSearchParams(searchParams.toString());
        const hadSearch = searchParams.has('search');

        if (newValue) {
            params.set('search', newValue);
            if (!hadSearch) {
                params.set('sortBy', 'relevance');
                params.set('sortOrder', 'desc');
            }
        } else {
            params.delete('search');
            if (params.get('sortBy') === 'relevance') {
                params.delete('sortBy');
                params.delete('sortOrder');
            }
        }

        // use replace() to avoid cluttering history stack with every character
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    const handleClear = () => {
        setValue('');
        const params = new URLSearchParams(searchParams.toString());
        params.delete('search');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        inputRef.current?.focus();
    };

    return (
        <div className='relative w-full'>
            <Input
                className='h-12 w-full rounded border border-border bg-card p-2 pr-10 !text-base text-card-foreground shadow-sm transition-all focus:border-ring'
                ref={inputRef}
                type='text'
                placeholder='Search for cards...'
                value={value}
                onChange={handleSearchChange}
            />
            {value && (
                <Button
                    variant={'ghost'}
                    size={'icon'}
                    onClick={handleClear}
                    className='absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-xl text-gray-400 hover:text-foreground md:text-base'
                    aria-label='Clear search'
                >
                    <X className='h-4 w-4' />
                </Button>
            )}
        </div>
    );
}
