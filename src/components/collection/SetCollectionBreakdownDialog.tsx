'use client';

import { useState, cloneElement, isValidElement, KeyboardEvent, MouseEvent } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/src/components/ui/dialog';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Progress } from '@/src/components/ui/progress';
import { useSetCollectionStats, ProgressRow } from '@/hooks/useSetCollectionStats';
import { DollarSign, TrendingUp, Package } from 'lucide-react';
import { Separator } from '@/src/components/ui/separator';

interface SetCollectionBreakdownDialogProps {
    setId: string;
    setName: string;
    children: React.ReactNode;
}

function ProgressBarRow({ row }: { row: ProgressRow }) {
    const percent = row.total > 0 ? (row.owned / row.total) * 100 : 0;
    return (
        <div className='space-y-1'>
            <div className='flex items-center justify-between text-sm'>
                <span className='text-foreground'>{row.label}</span>
                <span className='font-medium tabular-nums text-muted-foreground'>
                    {row.owned}/{row.total}
                </span>
            </div>
            <Progress value={percent} className='h-2' />
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className='space-y-4 p-1'>
            <div className='grid grid-cols-3 gap-3'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-[72px] rounded-lg' />
                ))}
            </div>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-3 w-full' />
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-3 w-full' />
        </div>
    );
}

function BreakdownContent({ setId }: { setId: string }) {
    const stats = useSetCollectionStats(setId);

    if (stats.isLoading) {
        return <LoadingSkeleton />;
    }

    const percent = stats.setTotal > 0 ? Math.round((stats.totalCollected / stats.setTotal) * 100) : 0;

    return (
        <div className='space-y-4'>
            {/* Summary Cards */}
            <div className='grid grid-cols-3 gap-3'>
                <div className='flex flex-col items-center gap-1 rounded-lg border bg-card p-3'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                        <Package className='h-3 w-3' />
                        <span>Owned</span>
                    </div>
                    <span className='text-xl font-bold tabular-nums'>
                        {stats.totalCollected}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                        of {stats.setTotal} ({percent}%)
                    </span>
                </div>
                <div className='flex flex-col items-center gap-1 rounded-lg border bg-card p-3'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                        <TrendingUp className='h-3 w-3' />
                        <span>Market</span>
                    </div>
                    <span className='text-xl font-bold tabular-nums'>
                        ${stats.marketValue.toFixed(2)}
                    </span>
                    <span className='text-xs text-muted-foreground'>value</span>
                </div>
                <div className='flex flex-col items-center gap-1 rounded-lg border bg-card p-3'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                        <DollarSign className='h-3 w-3' />
                        <span>Cost</span>
                    </div>
                    <span className='text-xl font-bold tabular-nums'>
                        ${stats.costBasis.toFixed(2)}
                    </span>
                    <span className='text-xs text-muted-foreground'>basis</span>
                </div>
            </div>

            {/* Overall Progress */}
            <div className='space-y-1'>
                <ProgressBarRow row={stats.overallProgress} />
            </div>

            {/* Variant Breakdown */}
            {stats.variantProgress.length > 0 && (
                <>
                    <Separator />
                    <div className='space-y-3'>
                        <h4 className='text-base font-semibold text-foreground'>Variant</h4>
                        {stats.variantProgress.map((row) => (
                            <ProgressBarRow key={row.label} row={row} />
                        ))}
                    </div>
                </>
            )}

            {/* Rarity Breakdown */}
            {stats.rarityProgress.length > 0 && (
                <>
                    <Separator />
                    <div className='space-y-3'>
                        <h4 className='text-base font-semibold text-foreground'>Rarity</h4>
                        {stats.rarityProgress.map((row) => (
                            <ProgressBarRow key={row.label} row={row} />
                        ))}
                    </div>
                </>
            )}

            {/* Artist Breakdown */}
            {stats.artistProgress.length > 0 && (
                <>
                    <Separator />
                    <div className='space-y-3'>
                        <h4 className='text-base font-semibold text-foreground'>Artist</h4>
                        {stats.artistProgress.map((row) => (
                            <ProgressBarRow key={row.label} row={row} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export function SetCollectionBreakdownDialog({
    setId,
    setName,
    children
}: SetCollectionBreakdownDialogProps) {
    const [open, setOpen] = useState(false);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
    };

    const handleOpen = (e: MouseEvent | KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
    };

    const triggerProps = {
        role: 'button' as const,
        tabIndex: 0,
        'aria-haspopup': 'dialog' as const,
        'aria-expanded': open,
        onClick: handleOpen,
        onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleOpen(e);
            }
        }
    };

    return (
        <>
            {isValidElement(children)
                ? cloneElement(children as React.ReactElement<Record<string, unknown>>, triggerProps)
                : <span {...triggerProps}>{children}</span>
            }
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    className='!flex max-h-[85vh] !flex-col !gap-0 sm:max-w-lg'
                >
                    <DialogHeader className='shrink-0 pb-4'>
                        <DialogTitle>{setName} — Collection Progress</DialogTitle>
                        <DialogDescription>
                            Your collection progress for this set, broken down by variant, rarity, and artist.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='min-h-0 flex-1 overflow-y-auto'>
                        <BreakdownContent setId={setId} />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}