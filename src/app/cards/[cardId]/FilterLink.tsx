'use client';

import Link from 'next/link';
import { useSearchStore } from '@/src/lib/store/searchStore';

interface FilterLinkProps {
    field: string;
    value: string;
    label?: string;
}

export function FilterLink({ field, value, label }: FilterLinkProps) {
    const setFilters = useSearchStore((state) => state.setFilters);
    const displayValue = label || value; // Use label if provided, else value

    // Set links navigate to the canonical, fully server-rendered set page —
    // a crawlable hub with clean URLs instead of a /cards filter URL.
    if (field === 'setId') {
        return (
            <Link
                href={`/sets/${encodeURIComponent(value)}`}
                className='text-primary hover:underline'
            >
                {displayValue}
            </Link>
        );
    }

    return (
        <Link
            href={`/cards?${field}=${encodeURIComponent(value)}`}
            className='text-primary hover:underline'
            onClick={() => setFilters({ [field]: value, search: undefined })}
        >
            {displayValue}
        </Link>
    );
}
