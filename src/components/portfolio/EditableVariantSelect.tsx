'use client';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { CardVariant } from '@prisma/client';
import { toast } from 'sonner';
import { useState } from 'react';

export function EditableVariantSelect({
    id,
    initialVariant
}: {
    id: string;
    initialVariant: CardVariant
}) {
    const updateEntry = useCollectionStore((state) => state.updateEntry);
    const [val, setVal] = useState(initialVariant);

    const handleChange = async (newValue: string) => {
        const variant = newValue as CardVariant;
        const previousVal = val;
        setVal(variant); // Optimistic UI update

        try {
            await updateEntry(id, { variant });
            toast.success('Variant updated');
        } catch (error) {
            toast.error('Failed to update variant');
            setVal(previousVal); // Revert on error
        }
    };

    return (
        <Select value={val} onValueChange={handleChange}>
            <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {Object.values(CardVariant).map((v) => (
                    <SelectItem key={v} value={v}>
                        {v === 'FirstEdition' ? '1st Edition' : v === 'Reverse' ? 'Reverse Holo' : v}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}