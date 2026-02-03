'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SetObject } from '@/src/shared-types/card-index';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

interface SetCardProps {
    set: SetObject;
    isPriority?: boolean;
}

export function SetCard({ set, isPriority = false }: SetCardProps) {
    return (
        <Link
            href={`/sets/${set.id}?sortBy=num&sortOrder=asc`}
            prefetch={null}
            className='group flex flex-col items-center justify-between rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-accent'
        >
            {/* Header */}
            <div className='flex w-full flex-col items-center text-center'>
                <div className='mb-2 flex items-center justify-center gap-2'>
                    {set.symbolImageKey && (
                        <Image
                            src={set.symbolImageKey}
                            alt={`${set.name} 'symbol'`}
                            width={30}
                            height={30}
                            className='object-contain'
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
                        <Image
                            src={set.logoImageKey}
                            alt={set.name}
                            fill
                            className='object-contain transition-transform group-hover:scale-110'
                            fetchPriority={isPriority ? 'high' : undefined}
                            loading={isPriority ? 'eager' : 'lazy'}
                        />
                    ) : (
                        <div className='flex h-full w-full items-center justify-center rounded-sm bg-muted/50 text-xs text-muted-foreground'>
                            No Logo
                        </div>
                    )}
                </div>
                <div className='mt-2 flex flex-col items-center justify-center text-sm text-muted-foreground'>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <p
                                    className='cursor-help'
                                    aria-label={`${set.total} total cards in set, numbered to ${set.printedTotal}`}
                                >
                                    {set.total}/{set.printedTotal} cards
                                </p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className='text-xs'>
                                    {set.total} total cards / {set.printedTotal} numbered
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <p>{set.releaseDate}</p>
                </div>
            </div>
        </Link>
    );
}
