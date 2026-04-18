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
import { EditableVariantSelect } from './EditableVariantSelect';
import { EditablePriceInput } from './EditablePriceInput';
import { EditableDate } from './EditableDate';
import { SafeDeleteButton } from './SafeDeleteButton';
import { CardVariant } from '@prisma/client';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { useCardStore } from '@/src/lib/store/cardStore';

interface CollectionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: string;
    cardName: string;
    entryId?: string; 
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
    const storeEntries = useCollectionStore((state) => state.entries);
    
    const entries = storeEntries.filter((e) => {
        if (entryId) return e.id === entryId;
        return e.cardId === cardId;
    });

    // We pull the card capabilities from our fast local 21k database
    const cardMap = useCardStore((state) => state.cardMap);
    const localCardInfo = cardMap.get(cardId);
    
    const validVariants: CardVariant[] = [];
    if (localCardInfo) {
        if (localCardInfo.hasNormal) validVariants.push(CardVariant.Normal);
        if (localCardInfo.hasHolo) validVariants.push(CardVariant.Holo);
        if (localCardInfo.hasReverse) validVariants.push(CardVariant.Reverse);
        if (localCardInfo.hasFirstEdition) validVariants.push(CardVariant.FirstEdition);
    }
    if (validVariants.length === 0) validVariants.push(CardVariant.Normal);

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

                <div className='max-h-[60vh] overflow-y-auto'>
                    <Table className='w-full table-fixed'>
                        <TableHeader className='hidden md:table-header-group'>
                            <TableRow>
                                <TableHead className='w-[30%]'>Acquired</TableHead>
                                <TableHead className='w-[30%]'>Variant</TableHead>
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
                                        <EditableDate
                                            id={entry.id}
                                            date={entry.createdAt}
                                        />
                                    </TableCell>
                                    {/* Variant */}
                                    <TableCell className='flex items-center justify-between border-none px-0 py-3 md:table-cell md:py-4 md:pl-2'>
                                        <MobileLabel>Variant</MobileLabel>
                                        <EditableVariantSelect
                                            id={entry.id}
                                            initialVariant={entry.variant || 'Normal'}
                                            validVariants={validVariants} // <-- Uses the top-level array
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
            </DialogContent>
        </Dialog>
    );
}