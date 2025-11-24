'use client';
import { useState } from 'react';
import { trpc } from '@/src/utils/trpc';
import { Button } from '@/src/components/ui/button';
import { Plus, Minus, Check, Loader2, Trash2 } from 'lucide-react';
import { CardCondition } from '@prisma/client';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { useSession } from '@/src/lib/auth-client';
import { useRouter } from 'next/navigation';

interface CollectionControlProps {
    cardId: string;
    currentPrice: number | null;
    entryId?: string;
}

export function CollectionControl({ cardId, currentPrice, entryId }: CollectionControlProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const utils = trpc.useUtils();
    const [isSuccess, setIsSuccess] = useState(false);

    const { data: collectionEntries, isLoading } = trpc.collection.getCollection.useQuery();

    const myEntries = useMemo(() => {
        if (!collectionEntries) return [];
        // Sort duplicates by entry date
        const entries = collectionEntries.filter((entry) => entry.cardId === cardId);
        return entries.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [collectionEntries, cardId]);

    const count = myEntries.length;

    // CRUD mutations
    const addMutation = trpc.collection.addToCollection.useMutation({
        onSuccess: () => {
            setIsSuccess(true);
            toast.success('Added to collection');
            utils.collection.getCollection.invalidate();
            setTimeout(() => setIsSuccess(false), 2000);
        },
        onError: (error) => {
            toast.error(`Failed to add: ${error.message}`);
        }
    });

    const removeMutation = trpc.collection.removeFromCollection.useMutation({
        onSuccess: () => {
            toast.success('Removed from collection');
            utils.collection.getCollection.invalidate();
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`);
        }
    });

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!session) {
            toast.info('Please sign in to track your collection');
            router.push('/sign-in');
            return;
        }

        addMutation.mutate({
            cardId,
            purchasePrice: currentPrice || 0,
            condition: CardCondition.tcgNearMint
        });
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (entryId) {
            removeMutation.mutate({ entryId });
        } else {
            if (count === 0) return;
            // LIFO: remove the most recent entry
            const entryToRemove = myEntries[0];
            if (entryToRemove) {
                removeMutation.mutate({ entryId: entryToRemove.id });
            }
        }
    };

    const isPending = isLoading || addMutation.isPending || removeMutation.isPending;

    // Guest states
    if (!session) {
        return (
            <Button
                variant='secondary'
                size='icon'
                className='h-8 w-8 rounded-full bg-white/90 text-black shadow-md transition-all hover:scale-110 hover:bg-white'
                onClick={handleAdd}
            >
                <Plus className='h-4 w-4' />
            </Button>
        );
    }

    // Loading state
    if (!collectionEntries || isLoading) {
        return <div className='h-8 w-8 rounded-full bg-white/50 shadow-md backdrop-blur-sm' />;
    }

    if (entryId) {
        return (
            <Button
                variant='destructive'
                size='icon'
                className='h-8 w-8 rounded-full opacity-80 shadow-md transition-all hover:opacity-100'
                onClick={handleRemove}
                disabled={isPending}
                aria-label='Remove specific entry'
            >
                {removeMutation.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                    <Trash2 className='h-4 w-4' />
                )}
            </Button>
        );
    }

    // Global counters
    // User owns 0 of this card -> show 'Add' button
    if (count === 0) {
        return (
            <Button
                variant='secondary'
                size={'icon'}
                className={`h-8 w-8 rounded-full shadow-md transition-all duration-300 hover:scale-110 ${
                    isSuccess
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-white/90 text-black hover:bg-white'
                }`}
                onClick={handleAdd}
                disabled={isPending}
                aria-label='Add to Collection'
            >
                {isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                ) : isSuccess ? (
                    <Check className='h-4 w-4' />
                ) : (
                    <Plus className='h-4 w-4' />
                )}
            </Button>
        );
    }

    // User owns 1+ -> show counter controls [- 1 +]
    return (
        <div
            className='flex items-center gap-1 rounded-full bg-black/80 p-1 shadow-md backdrop-blur-sm'
            onClick={(e) => e.preventDefault()}
        >
            <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6 rounded-full text-white hover:bg-white/20 hover:text-white'
                onClick={handleRemove}
                disabled={isPending}
            >
                <Minus className='h-3 w-3' />
            </Button>
            <span className='min-w-[20px] text-center text-xs font-bold tabular-nums text-white'>
                {isPending ? <Loader2 className='h-3 w-3 animate-spin' /> : count}
            </span>
            <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6 rounded-full text-white hover:bg-white/20 hover:text-white'
                onClick={handleAdd}
                disabled={isPending}
            >
                <Plus className='h-3 w-3' />
            </Button>
        </div>
    );
}
