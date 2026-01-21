'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/src/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/src/components/ui/table';
import { trpc } from '@/src/utils/trpc';
import { Loader2, Trash2, Save } from 'lucide-react';
import { EditableConditionSelect } from './EditableConditionSelect';
import { EditablePriceInput } from './EditablePriceInput';
import { EditableDate } from './EditableDate';
import { SafeDeleteButton } from './SafeDeleteButton';
import { useRouter } from 'next/navigation';

interface CollectionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: string;
    cardName: string;
    entryId?: string; // If present, we are editing a SPECIFIC card (Dashboard mode)
}

const MobileLabel = ({ children }: { children: React.ReactNode }) => (
    <span className='mr-2 text-sm font-semibold text-muted-foreground md:hidden'>{children}</span>
);

export function CollectionManagerModal({
    isOpen,
    onClose,
    cardId,
    cardName,
    entryId
}: CollectionManagerModalProps) {
    // If entryId is missing, we fetch ALL copies (Browsing mode)
    const {
        data: entries,
        isLoading,
        refetch
    } = trpc.collection.getCollection.useQuery(undefined, {
        select: (data) => {
            const allEntries = data.entries;
            if (entryId) {
                return allEntries.filter((e) => e.id === entryId);
            }
            return allEntries.filter((e) => e.cardId === cardId);
        },
        enabled: isOpen
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className='sm:max-w-4xl'>
                <DialogHeader>
                    <DialogTitle>Manage {cardName}</DialogTitle>
                    <DialogDescription>
                        {entryId
                            ? 'Edit details for this copy.'
                            : 'Manage all copies in your collection.'}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className='flex justify-center p-8'>
                        <Loader2 className='animate-spin' />
                    </div>
                ) : (
                    <div className='max-h-[60vh] overflow-y-auto'>
                        <Table className='w-full table-fixed'>
                            <TableHeader className='hidden md:table-header-group'>
                                <TableRow>
                                    <TableHead className='w-[30%]'>Acquired</TableHead>
                                    <TableHead className='w-[30%]'>Condition</TableHead>
                                    <TableHead className='w-[20%]'>Price Paid</TableHead>
                                    <TableHead className='w-[20%]'>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries?.map((entry) => (
                                    <TableRow
                                        key={entry.id}
                                        className='flex flex-col divide-y divide-border/50 border-b p-4 md:table-row md:divide-y-0 md:border-b'
                                    >
                                        {/* Date */}
                                        <TableCell className='flex items-center justify-between border-none px-0 py-3 md:table-cell md:py-4 md:pl-2'>
                                            <MobileLabel>Acquired</MobileLabel>
                                            <EditableDate id={entry.id} date={entry.createdAt} />
                                        </TableCell>
                                        {/* Condition */}
                                        <TableCell className='flex items-center justify-between border-none px-0 py-3 md:table-cell md:py-4 md:pl-2'>
                                            <MobileLabel>Condition</MobileLabel>
                                            <EditableConditionSelect
                                                id={entry.id}
                                                initialCondition={entry.condition}
                                            />
                                        </TableCell>
                                        {/* Price */}
                                        <TableCell className='flex items-center justify-between border-none px-0 py-3 md:table-cell md:py-4 md:pl-2'>
                                            <MobileLabel>Cost</MobileLabel>
                                            <EditablePriceInput
                                                id={entry.id}
                                                initialPrice={Number(entry.purchasePrice)}
                                            />
                                        </TableCell>
                                        <TableCell className='flex items-center justify-between border-none px-0 py-3 md:table-cell md:py-4 md:pl-2 md:pr-4'>
                                            <span className='text-sm font-bold text-muted-foreground md:hidden'>
                                                Actions:
                                            </span>
                                            <SafeDeleteButton id={entry.id} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {entries?.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className='text-center text-muted-foreground'
                                        >
                                            No copies found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
