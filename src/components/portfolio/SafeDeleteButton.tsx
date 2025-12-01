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
import { trpc } from '@/src/utils/trpc';
import { toast } from 'sonner';

interface SafeDeleteButtonProps {
    id: string;
    onDelete?: () => void; // Optional callback after success
}

export function SafeDeleteButton({ id, onDelete }: SafeDeleteButtonProps) {
    const [open, setOpen] = useState(false);
    const utils = trpc.useUtils();

    const mutation = trpc.collection.removeFromCollection.useMutation({
        onSuccess: () => {
            toast.success('Card removed');
            utils.collection.getCollection.invalidate();
            setOpen(false);
            onDelete?.();
        },
        onError: (err) => {
            toast.error(`Error: ${err.message}`);
        }
    });

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='hover:text-destructive h-8 w-auto text-muted-foreground'
                    onClick={(e) => e.stopPropagation()}
                >
                    {mutation.isPending ? (
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
                        onClick={(e) => {
                            e.preventDefault();
                            mutation.mutate({ entryId: id });
                        }}
                    >
                        {mutation.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
