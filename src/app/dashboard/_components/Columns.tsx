'use client';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import Image from 'next/image';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

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
                    className='pl-0 font-semibold hover:bg-transparent'
                >
                    Card
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            );
        },
        cell: ({ row }) => {
            const img = row.original.image;
            return (
                <div className='flex items-center gap-4 py-1'>
                    <div className='relative aspect-[2.5/3.5] h-16 shrink-0 overflow-hidden rounded border bg-muted'>
                        {img && (
                            <Image
                                src={`${R2_PUBLIC_URL}/${img}`}
                                alt={row.original.name}
                                fill
                                className='object-cover'
                                sizes='48px'
                            />
                        )}
                    </div>
                    <div className='flex flex-col gap-1'>
                        <span className='text-base font-medium'>{row.original.name}</span>
                        <span className='text-sm text-foreground'>{row.original.setName}</span>
                    </div>
                </div>
            );
        }
    },
    {
        accessorKey: 'condition',
        header: 'Cond.',
        cell: ({ row }) => (
            <span className='rounded-md border bg-muted px-2 py-1 text-xs font-medium'>
                {row.original.condition}
            </span>
        )
    },
    {
        accessorKey: 'purchasedAt',
        header: ({ column }) => (
            <Button
                variant='ghost'
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className='hover:bg-transparent'
            >
                Date Acquired
                <ArrowUpDown className='ml-2 h-4 w-4' />
            </Button>
        ),
        cell: ({ row }) => {
            return (
                <span className='text-base text-foreground'>
                    {new Date(row.original.purchasedAt).toLocaleDateString()}
                </span>
            );
        }
    },
    {
        accessorKey: 'purchasePrice',
        header: ({ column }) => (
            <div className='text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='pr-0 hover:bg-transparent'
                >
                    Purchase Cost
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const amount = row.getValue('purchasePrice') as number;
            return <div className='text-right text-base text-foreground'>${amount.toFixed(2)}</div>;
        }
    },
    {
        accessorKey: 'currentPrice',
        header: ({ column }) => (
            <div className='text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='pr-0 hover:bg-transparent'
                >
                    Market Value
                    <ArrowUpDown className='ml-2 h-4 w-4' />
                </Button>
            </div>
        ),
        cell: ({ row }) => {
            const amount = row.getValue('currentPrice') as number;
            return <div className='text-right text-base'>${amount.toFixed(2)}</div>;
        }
    },
    {
        accessorKey: 'gain',
        header: ({ column }) => (
            <div className='text-right'>
                <Button
                    variant='ghost'
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    className='pr-0 hover:bg-transparent'
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
                    className={`flex flex-col items-end text-right text-base ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}
                >
                    <span className='font-bold'>
                        {isProfit ? '+' : ''}
                        {gain.toFixed(2)}
                    </span>
                    <span className='text-sm'>
                        {isProfit ? '▲' : '▼'} {percent.toFixed(1)}%
                    </span>
                </div>
            );
        }
    }
];
