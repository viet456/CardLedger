'use client';

import Link from 'next/link';

interface FilterLinkProps {
    field: string;
    value: string;
    label?: string;
}

export function FilterLink({ field, value, label }: FilterLinkProps) {
    const displayValue = label || value; // Use label if provided, else value
    return (
        <Link
            href={`/cards?${field}=${encodeURIComponent(value)}`}
            className='text-primary hover:underline'
        >
            {displayValue}
        </Link>
    );
}
