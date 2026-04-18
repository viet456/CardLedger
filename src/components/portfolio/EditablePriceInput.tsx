'use client';
import { useState } from 'react';
import { Input } from '@/src/components/ui/input';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { toast } from 'sonner';
    import { Pencil, Check } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

export function EditablePriceInput({ id, initialPrice }: { id: string; initialPrice: number }) {
    const [value, setValue] = useState(initialPrice);
    const [isEditing, setIsEditing] = useState(false);
    const updateEntry = useCollectionStore((state) => state.updateEntry);

    const onSave = async () => {
        if (value === initialPrice) {
            setIsEditing(false);
            return;
        }
        
        try {
            await updateEntry(id, { purchasePrice: Number(value) });
            toast.success('Price updated');
            setIsEditing(false);
        } catch (error) {
            toast.error('Failed to update price');
            setValue(initialPrice); // Revert on error
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    autoFocus
                    type='number'
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && onSave()}
                    className='h-8 w-24'
                />
                <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10 hover:bg-accent border border-border border-accent-foreground hover:border-accent"
                    onClick={onSave}
                >
                    <Check className="h-4 w-4" />
                </Button>
            </div>
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