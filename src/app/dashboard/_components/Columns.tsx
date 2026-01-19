'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import Image from 'next/image';

export type PortfolioRow = {
    id: string;
    cardId: string;
    name: string;
    setName: string;
    image: string | null;
    condition: string;
    purchasedAt: string;
    purchasePrice: number;
    currentPrice: number;
    gain: number;
    gainPercent: number;
};

export const columns: ColumnDef<PortfolioRow>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => {
            return (
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='justify-start pl-0 font-semibold hover:bg-transparent' // Force Left Align
                >
                    Card
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            );
        },
        cell: ({ row }) => {
            const img = row.original.image;
            return (
                <div className='flex items-center gap-3 py-1'>
                    <div className='relative aspect-[2.5/3.5] h-12 w-auto shrink-0 overflow-hidden rounded border bg-muted shadow-sm'>
                        {img && (
                            <Image
                                src={img}
                                alt={row.original.name}
                                fill
                                className='object-cover'
                                sizes='48px'
                            />
                        )}
                    </div>
                    <div className='flex flex-col'>
                        <span className='max-w-[120px] truncate text-base font-semibold md:max-w-none'>
                            {row.original.name}
                        </span>
                        <span className='max-w-[120px] truncate text-sm text-muted-foreground md:max-w-none'>
                            {row.original.setName}
                        </span>
                    </div>
                </div>
            );
        }
    },
    {
        accessorKey: 'condition',
        header: ({ column }) => (
            <div className=''>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='hover:bg-transparent'
                >
                    Condition
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => (
            <div className='flex items-center'>
                <span className='rounded-md border bg-muted px-2 py-1 text-sm font-medium'>
                    {row.original.condition}
                </span>
            </div>
        )
    },
    {
        accessorKey: 'purchasedAt',
        header: ({ column }) => (
            <div className=''>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='font-semibold hover:bg-transparent'
                >
                    Acquired
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            return (
                <span className='text-base text-muted-foreground'>
                    {new Date(row.original.purchasedAt).toLocaleDateString()}
                </span>
            );
        }
    },
    {
        accessorKey: 'purchasePrice',
        header: ({ column }) => (
            <div className='w-full text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='w-full justify-end pr-0 font-semibold hover:bg-transparent' // Force Right Align
                >
                    Cost
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const amount = row.getValue('purchasePrice') as number;
            return <div className='text-right text-base font-medium'>${amount.toFixed(2)}</div>;
        }
    },
    {
        accessorKey: 'currentPrice',
        header: ({ column }) => (
            <div className='w-full text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='w-full justify-end pr-0 font-semibold hover:bg-transparent' // Force Right Align
                >
                    Value
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const amount = row.getValue('currentPrice') as number;
            return <div className='text-right text-base font-bold'>${amount.toFixed(2)}</div>;
        }
    },
    {
        accessorKey: 'gain',
        header: ({ column }) => (
            <div className='w-full text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='w-full justify-end pr-0 font-semibold hover:bg-transparent'
                >
                    Gain/Loss
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const gain = row.original.gain;
            const percent = row.original.gainPercent;
            const isProfit = gain >= 0;

            return (
                <div
                    className={`flex flex-col items-end text-right ${isProfit ? 'text-trend-up' : 'text-trend-down'}`}
                >
                    <span className='text-base font-bold'>
                        {isProfit ? '+' : ''}
                        {gain.toFixed(2)}
                    </span>
                    <span className='text-sm font-medium'>
                        {isProfit ? '▲' : '▼'} {percent.toFixed(1)}%
                    </span>
                </div>
            );
        }
    }
];
