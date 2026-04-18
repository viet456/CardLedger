'use client';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/src/components/ui/alert-dialog';
import { Button } from '@/src/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { toast } from 'sonner';

interface SafeDeleteButtonProps {
    id: string;
    onDelete?: () => void; // Optional callback after success
}

export function SafeDeleteButton({ id, onDelete }: SafeDeleteButtonProps) {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const removeEntry = useCollectionStore((state) => state.removeEntry);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDeleting(true);
        try {
            await removeEntry(id); // This handles the optimistic UI update AND the tRPC call
            toast.success('Card removed');
            setOpen(false);
            onDelete?.();
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='hover:text-destructive h-8 w-auto text-muted-foreground'
                    onClick={(e) => e.stopPropagation()}
                >
                    {isDeleting ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                        <span className='flex items-center gap-2 px-3'>
                            <Trash2 className='h-4 w-4' />
                            Delete
                        </span>
                    )}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove this copy from your collection.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        onClick={handleDelete}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
