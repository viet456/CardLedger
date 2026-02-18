'use client';
import { useState, useMemo, useRef } from 'react';
import { Button } from '@/src/components/ui/button';
import { Plus, Minus, Loader2, Trash2, Pencil } from 'lucide-react';
import { CollectionManagerModal } from './CollectionManagerModal';
import { CardVariant } from '@prisma/client';
import { toast } from 'sonner';
import { useAuthSession } from '@/src/providers/SessionProvider';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip';
import { useCollectionStore } from '@/src/lib/store/collectionStore';

interface CollectionControlProps {
    cardId: string;
    currentPrice: number | null;
    entryId?: string;
    cardName?: string;
}

export function CollectionControl({
    cardId,
    currentPrice,
    entryId,
    cardName = 'Card'
}: CollectionControlProps) {
    const { data: session } = useAuthSession();
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const pendingDeletesRef = useRef<Set<string>>(new Set());

    const collectionEntries = useCollectionStore((state) => state.entries);
    const collectionStatus = useCollectionStore((state) => state.status);
    const addEntry = useCollectionStore((state) => state.addEntry);
    const removeEntry = useCollectionStore((state) => state.removeEntry);

    const myEntries = useMemo(() => {
        if (!collectionEntries) return [];
        // Sort duplicates by entry date
        const entries = collectionEntries.filter((entry) => entry.cardId === cardId);
        return entries.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [collectionEntries, cardId]);

    const count = myEntries.length;

    const handleAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!session) {
            toast.info('Please sign in to track your collection');
            router.push('/sign-in');
            return;
        }

        setIsAdding(true);
        try {
            await addEntry({
                cardId,
                purchasePrice: currentPrice || 0,
                // Default variant, to be edited later in modal
                // Should be refactored to the card's primary variant
                variant: CardVariant.Normal
            });
            toast.success('Added to collection');
        } catch (error) {
            toast.error('Failed to add card');
            console.error(error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (entryId) {
            // Dashboard mode: remove specific entry
            setIsRemoving(true);
            try {
                await removeEntry(entryId);
                toast.success('Removed from collection');
            } catch (error) {
                toast.error('Failed to remove card');
                console.error(error);
            } finally {
                setIsRemoving(false);
            }
        } else {
            // Browse mode: remove most recent entry (LIFO)
            if (count === 0) return;

            const entryToRemove = myEntries.find(
                (entry) => !pendingDeletesRef.current.has(entry.id)
            );

            if (entryToRemove) {
                pendingDeletesRef.current.add(entryToRemove.id);
                setIsRemoving(true);
                try {
                    await removeEntry(entryToRemove.id);
                    toast.success('Removed from collection');
                } catch (error) {
                    toast.error('Failed to remove card');
                    console.error(error);
                } finally {
                    pendingDeletesRef.current.delete(entryToRemove.id);
                    setIsRemoving(false);
                }
            }
        }
    };

    // Guest states
    if (!session) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant='secondary'
                        size='icon'
                        className='h-8 w-8 rounded-full bg-white/90 text-black shadow-md transition-all hover:scale-110 hover:bg-white'
                        onClick={handleAdd}
                        aria-label='Sign in to add to collection'
                    >
                        <Plus className='h-4 w-4' />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className='px-2 py-1'>
                    <p className='text-xs'>Sign in to collect</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    // Dashboard mode
    if (entryId) {
        return (
            <>
                <div className='flex items-center gap-1'>
                    {/* Edit Tooltip */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='secondary'
                                size='icon'
                                className='h-8 w-8 rounded-full bg-background text-primary opacity-80 shadow-md transition-all hover:scale-110 hover:opacity-100'
                                onClick={() => setIsEditModalOpen(true)}
                                aria-label={`Edit details for ${cardName}`}
                            >
                                <Pencil className='h-4 w-4' />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className='px-2 py-1'>
                            <p className='text-xs'>Edit details</p>
                        </TooltipContent>
                    </Tooltip>

                    {/* Delete Tooltip */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='destructive'
                                size='icon'
                                className='h-8 w-8 rounded-full bg-background text-primary opacity-80 shadow-md transition-all hover:scale-110 hover:opacity-100'
                                onClick={handleRemove}
                                disabled={isRemoving}
                                aria-label={`Remove ${cardName} from collection`}
                            >
                                {isRemoving ? (
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                ) : (
                                    <Trash2 className='h-4 w-4' />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className='px-2 py-1'>
                            <p className='text-xs'>Remove copy</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <CollectionManagerModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    cardId={cardId}
                    cardName={cardName}
                    entryId={entryId}
                />
            </>
        );
    }

    // Loading state
    if (collectionStatus === 'loading' || collectionStatus === 'idle') {
        return <div className='h-8 w-8 rounded-full bg-white/50 shadow-md backdrop-blur-sm' />;
    }

    // Browse mode
    // User owns 0 of this card -> show 'Add' button
    if (count === 0) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant='secondary'
                        size={'icon'}
                        className='h-8 w-8 rounded-full bg-white/90 text-black shadow-md transition-all duration-300 hover:scale-110 hover:bg-white'
                        onClick={handleAdd}
                        aria-label={`Add ${cardName} to collection`}
                    >
                        <Plus className='h-4 w-4' />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className='px-2 py-1'>
                    <p className='text-xs'>Add to collection</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    // User owns 1+ -> show counter controls [- 1 +]
    return (
        <>
            <div
                className='flex items-center gap-1 rounded-full bg-black/80 p-1 shadow-md backdrop-blur-sm'
                onClick={(e) => e.preventDefault()}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6 rounded-full text-white hover:bg-white/20'
                            onClick={handleRemove}
                            aria-label='Decrease quantity'
                        >
                            <Minus className='h-3 w-3' />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className='px-2 py-1'>
                        <p className='text-xs'>Remove copy</p>
                    </TooltipContent>
                </Tooltip>

                <span className='min-w-[20px] text-center text-xs font-bold tabular-nums text-white'>
                    {count}
                </span>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6 rounded-full text-white hover:bg-white/20'
                            onClick={handleAdd}
                            aria-label='Increase quantity'
                        >
                            <Plus className='h-3 w-3' />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className='px-2 py-1'>
                        <p className='text-xs'>Add another</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </>
    );
}
