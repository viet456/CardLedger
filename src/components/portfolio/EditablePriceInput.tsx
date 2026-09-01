'use client';
import { useState, useCallback } from 'react';
import { Input } from '@/src/components/ui/input';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { useCurrencyStore, useFormatPrice, useConvertToUsd, CURRENCIES } from '@/src/lib/store/currencyStore';
import { toast } from 'sonner';
import { Pencil, Check } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

export function EditablePriceInput({ id, initialPrice }: { id: string; initialPrice: number }) {
    const currency = useCurrencyStore((s) => s.currency);
    const formatPrice = useFormatPrice();
    const convertToUsd = useConvertToUsd();

    const toLocalCurrency = useCallback((usdAmount: number) => {
        const decimals = new Intl.NumberFormat(CURRENCIES[currency].locale, {
            style: 'currency',
            currency,
        }).resolvedOptions().maximumFractionDigits;
        return Number((usdAmount * (useCurrencyStore.getState().rates[currency] ?? 1)).toFixed(decimals));
    }, [currency]);

    // editValue only exists while editing — display derives from initialPrice directly
    const [editValue, setEditValue] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const updateEntry = useCollectionStore((state) => state.updateEntry);

    const startEditing = () => {
        setEditValue(toLocalCurrency(initialPrice));
        setIsEditing(true);
    };

    const onSave = async () => {
        const usdValue = currency === 'USD' ? editValue : convertToUsd(editValue, currency);

        // Compare formatted display strings — currency-aware (JPY/KRW compare as integers, USD/EUR as 2-decimal)
        if (formatPrice(usdValue) === formatPrice(initialPrice)) {
            setIsEditing(false);
            return;
        }

        try {
            await updateEntry(id, { purchasePrice: usdValue });
            toast.success('Price updated');
            setIsEditing(false);
        } catch {
            toast.error('Failed to update price');
        }
    };

    if (isEditing) {
        const currencyInfo = CURRENCIES[currency];
        return (
            <div className="flex items-center gap-2">
                <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {currencyInfo.symbol}
                    </span>
                    <Input
                        autoFocus
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && onSave()}
                        className="h-8 w-28 pl-6"
                    />
                </div>
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
            onClick={startEditing}
            className="group flex cursor-pointer items-center gap-3 rounded px-2 py-1"
        >
            <span>{formatPrice(initialPrice)}</span>
            <Pencil className="h-4 w-4 text-foreground opacity-50 transition-opacity group-hover:opacity-100" />
        </div>
    );
}