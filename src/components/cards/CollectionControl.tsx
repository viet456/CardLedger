'use client';
import { useState, useMemo, useRef } from 'react';
import { trpc } from '@/src/utils/trpc';
import { Button } from '@/src/components/ui/button';
import { Plus, Minus, Check, Loader2, Trash2, Pencil } from 'lucide-react';
import { CollectionManagerModal } from './CollectionManagerModal';
import { CardCondition } from '@prisma/client';
import { toast } from 'sonner';
import { useAuthSession } from '@/src/providers/SessionProvider';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip';

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
    const utils = trpc.useUtils();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const pendingDeletesRef = useRef<Set<string>>(new Set());

    const { data: collectionEntries, isLoading } = trpc.collection.getCollection.useQuery();
    type CollectionEntryData = NonNullable<typeof collectionEntries>[number];

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
        onMutate: async (newEntryVars) => {
            await utils.collection.getCollection.cancel();
            const previousCollection = utils.collection.getCollection.getData();
            const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
            // Create a temporary "Optimistic" entry
            const optimisticEntry = {
                id: optimisticId,
                userId: session?.user?.id || 'temp',
                cardId: newEntryVars.cardId,
                purchasePrice: newEntryVars.purchasePrice,
                condition: newEntryVars.condition,
                createdAt: new Date(),
                updatedAt: new Date(),
                card: { id: newEntryVars.cardId }
            } as unknown as CollectionEntryData;

            utils.collection.getCollection.setData(undefined, (old) => {
                return old ? [optimisticEntry, ...old] : [optimisticEntry];
            });

            return { previousCollection, optimisticId };
        },
        onSuccess: (realEntry, vars, context) => {
            utils.collection.getCollection.setData(undefined, (old) => {
                if (!old) return [];
                return old.map((entry) =>
                    entry.id === context.optimisticId
                        ? (realEntry as unknown as CollectionEntryData)
                        : entry
                );
            });
            toast.success('Added to collection');
        },
        onError: (error, vars, context) => {
            if (context?.previousCollection) {
                utils.collection.getCollection.setData(undefined, context.previousCollection);
            }
            toast.error(`Failed to add: ${error.message}`);
        }
    });

    const removeMutation = trpc.collection.removeFromCollection.useMutation({
        onMutate: async ({ entryId }) => {
            pendingDeletesRef.current.add(entryId);
            await utils.collection.getCollection.cancel();
            const previousCollection = utils.collection.getCollection.getData();

            utils.collection.getCollection.setData(undefined, (old) => {
                if (!old) return [];
                return old.filter((entry) => entry.id !== entryId);
            });

            return { previousCollection };
        },
        onSuccess: (data, variables) => {
            pendingDeletesRef.current.delete(variables.entryId);
            toast.success('Removed from collection');
            utils.collection.getCollection.invalidate();
        },
        onError: (error, variables, context) => {
            if (context?.previousCollection) {
                utils.collection.getCollection.setData(undefined, context.previousCollection);
            }
            pendingDeletesRef.current.delete(variables.entryId);
            toast.error(`Error: ${error.message}`);
        },
        onSettled: () => {
            utils.collection.getCollection.invalidate();
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
        if (count <= 0) return;

        if (entryId) {
            removeMutation.mutate({ entryId });
        } else {
            if (count === 0) return;
            // LIFO: remove the most recent entry
            const entryToRemove = myEntries.find(
                (entry) => !pendingDeletesRef.current.has(entry.id)
            );
            if (entryToRemove) {
                if (entryToRemove.id.startsWith('optimistic-')) {
                    utils.collection.getCollection.setData(undefined, (old) => {
                        return old?.filter((e) => e.id !== entryToRemove.id) || [];
                    });
                } else {
                    removeMutation.mutate({ entryId: entryToRemove.id });
                }
            }
        }
    };

    const isInteracting = addMutation.isPending || removeMutation.isPending;

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

    // Loading state
    if (!collectionEntries && isLoading) {
        return <div className='h-8 w-8 rounded-full bg-white/50 shadow-md backdrop-blur-sm' />;
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
                                disabled={removeMutation.isPending}
                            >
                                {removeMutation.isPending ? (
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
                    entryId={entryId} // Pass entryId so modal only shows THIS card
                />
            </>
        );
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
