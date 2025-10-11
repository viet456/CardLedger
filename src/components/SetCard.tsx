'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { SetObject } from '@/src/shared-types/card-index';

interface SetCardProps {
    set: SetObject;
}

export function SetCard({ set }: SetCardProps) {
    return (
        <Link
            href={`/sets/${set.id}`}
            className='hover:bg-muted/50 group flex flex-col items-center justify-between rounded-lg border bg-card p-4 text-card-foreground transition-colors'
        >
            {/* Header */}
            <div className='flex w-full flex-col items-center text-center'>
                <div className='mb-2 flex items-center justify-center gap-2'>
                    {set.symbolImageKey && (
                        <CldImage
                            src={set.symbolImageKey}
                            alt={`${set.name} symbol`}
                            width={30}
                            height={30}
                            className='object-contain'
                            format='auto'
                            quality='auto'
                        />
                    )}
                    <p className='text-md font-semibold'>{set.name}</p>
                    {set.ptcgoCode && (
                        <span className='rounded bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground'>
                            {set.ptcgoCode}
                        </span>
                    )}
                </div>
            </div>

            {/* Logo + Date */}
            <div className='flex w-full flex-col items-center justify-center'>
                <div className='relative flex aspect-[2/1] w-full items-center justify-center'>
                    {set.logoImageKey ? (
                        <CldImage
                            src={set.logoImageKey}
                            alt={`${set.name} logo`}
                            fill
                            className='object-contain transition-transform group-hover:scale-110'
                            format='auto'
                            quality='auto'
                        />
                    ) : (
                        <div className='bg-muted/50 flex h-full w-full items-center justify-center rounded-sm text-xs text-muted-foreground'>
                            No Logo
                        </div>
                    )}
                </div>
                <div className='mt-2 flex flex-col items-center justify-center text-sm text-muted-foreground'>
                    <p>{set.printedTotal} cards</p>
                    <p>{set.releaseDate}</p>
                </div>
            </div>
        </Link>
    );
}
