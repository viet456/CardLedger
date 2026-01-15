'use client';

import Link from 'next/link';
import { useSearchStore } from '@/src/lib/store/searchStore';

export function FilterLink({ field, value }: { field: string; value: string }) {
    const replaceFilters = useSearchStore((state) => state.replaceFilters);
    return (
        <Link
            href={`/cards?${field}=${encodeURIComponent(value)}`}
            className='text-primary hover:underline'
            onClick={() => replaceFilters({ [field]: value })}
        >
            {value}
        </Link>
    );
}
