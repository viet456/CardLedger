'use client';

import { useSyncExternalStore, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { useCurrencyStore, CURRENCIES, type Currency } from '@/src/lib/store/currencyStore';

export function CurrencyToggle() {
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    const currency = useCurrencyStore((s) => s.currency);
    const setCurrency = useCurrencyStore((s) => s.setCurrency);
    const fetchRates = useCurrencyStore((s) => s.fetchRates);

    // Fetch rates on mount if stale (> 24h) or missing
    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    if (!mounted) {
        return (
            <div className='flex h-8 w-[72px] items-center justify-center'>
                <span className='sr-only'>Select currency</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-[72px] justify-center gap-1.5 px-2 text-sm font-medium'
                >
                    <span className='text-sm font-medium'>{CURRENCIES[currency].symbol}</span>
                    <span className='text-xs text-muted-foreground'>{currency}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuLabel className='text-xs text-muted-foreground'>
                    Display Currency
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(CURRENCIES) as Currency[]).map((code) => {
                    const info = CURRENCIES[code];
                    return (
                        <DropdownMenuItem
                            key={code}
                            onClick={() => setCurrency(code)}
                            className='flex items-center justify-between'
                        >
                            <span>
                                {info.symbol} {info.label}
                            </span>
                            {currency === code && (
                                <span className='text-xs font-bold text-primary'>&#10003;</span>
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
