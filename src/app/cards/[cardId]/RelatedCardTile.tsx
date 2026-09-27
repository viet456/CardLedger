'use client';

import Link from 'next/link';
import { ResilientImage } from '@/src/components/cards/ResilientImage';
import r2ImageLoader from '@/src/lib/loader';

interface RelatedCardTileProps {
    href: string;
    imageKey: string | null;
    name: string;
    /** e.g. "Base Set · 58/102" */
    caption: string;
}

export function RelatedCardTile({ href, imageKey, name, caption }: RelatedCardTileProps) {
    return (
        <Link
            href={href}
            className='group flex w-full min-w-0 flex-col gap-1 rounded-lg p-1 transition-colors hover:bg-muted/60'
        >
            <div className='relative aspect-[2.5/3.5] w-full overflow-hidden rounded-md bg-muted'>
                <ResilientImage
                    loader={r2ImageLoader}
                    src={imageKey}
                    alt={name}
                    fill
                    // Same cache bucket as the card grid (see src/lib/loader.ts)
                    sizes='192px'
                    className='object-cover'
                    loading='lazy'
                />
            </div>
            <p className='truncate text-xs font-semibold leading-tight group-hover:underline'>
                {name}
            </p>
            <p className='truncate text-[10px] text-muted-foreground'>{caption}</p>
        </Link>
    );
}