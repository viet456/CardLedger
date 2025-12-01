'use client';
import { trpc } from '@/src/utils/trpc';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/src/components/ui/select';
import { CardCondition } from '@prisma/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function EditableConditionSelect({
    id,
    initialCondition
}: {
    id: string;
    initialCondition: CardCondition;
}) {
    const router = useRouter();
    const utils = trpc.useUtils();
    const mutation = trpc.collection.updateEntry.useMutation({
        onSuccess: () => {
            toast.success('Condition updated');
            utils.collection.getCollection.invalidate();
            router.refresh();
        }
    });

    return (
        <Select
            defaultValue={initialCondition}
            onValueChange={(val) =>
                mutation.mutate({ entryId: id, condition: val as CardCondition })
            }
        >
            <SelectTrigger>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {Object.values(CardCondition).map((c) => (
                    <SelectItem key={c} value={c}>
                        {c}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
