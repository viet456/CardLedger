'use client';
import { useState } from 'react';
import { Input } from '@/src/components/ui/input';
import { trpc } from '@/src/utils/trpc';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';

export function EditablePriceInput({ id, initialPrice }: { id: string; initialPrice: number }) {
    const [value, setValue] = useState(initialPrice);
    const [isEditing, setIsEditing] = useState(false);
    const utils = trpc.useUtils();

    const mutation = trpc.collection.updateEntry.useMutation({
        onSuccess: () => {
            toast.success('Price updated');
            setIsEditing(false);
            utils.collection.getCollection.invalidate(); // Refreshes both Modal and Ledger
        }
    });

    const onSave = () => {
        if (value === initialPrice) {
            setIsEditing(false);
            return;
        }
        mutation.mutate({ entryId: id, purchasePrice: Number(value) });
    };

    if (isEditing) {
        return (
            <Input
                autoFocus
                type='number'
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                onBlur={onSave}
                onKeyDown={(e) => e.key === 'Enter' && onSave()}
                className='h-8 w-24'
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className='group flex cursor-pointer items-center gap-3 rounded px-2 py-1'
        >
            <span>${Number(value).toFixed(2)}</span>
            <Pencil className='h-4 w-4 text-foreground opacity-50 transition-opacity group-hover:opacity-100' />
        </div>
    );
}
