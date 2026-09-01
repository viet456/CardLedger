import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSyncExternalStore, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'JPY' | 'CNY' | 'KRW' | 'AUD';

export interface CurrencyInfo {
    code: Currency;
    label: string;
    symbol: string;
    locale: string;
}

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
    USD: { code: 'USD', label: 'US Dollar', symbol: '$', locale: 'en-US' },
    EUR: { code: 'EUR', label: 'Euro', symbol: '\u20AC', locale: 'de-DE' },
    GBP: { code: 'GBP', label: 'British Pound', symbol: '\u00A3', locale: 'en-GB' },
    CAD: { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
    AUD: { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
    JPY: { code: 'JPY', label: 'Japanese Yen', symbol: '\u00A5', locale: 'ja-JP' },
    CNY: { code: 'CNY', label: 'Chinese Yuan', symbol: '\u00A5', locale: 'zh-CN' },
    KRW: { code: 'KRW', label: 'South Korean Won', symbol: '\u20A9', locale: 'ko-KR' },
};

// Hardcoded fallback rates (all relative to 1 USD)
const FALLBACK_RATES: Record<Currency, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.54,
    JPY: 149.5,
    CNY: 7.24,
    KRW: 1345,
};

const RATES_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_URL = 'https://open.er-api.com/v6/latest/USD';

// ── Intl.NumberFormat memo cache ───────────────────────────────────────────────
const _fmtCache = new Map<string, Intl.NumberFormat>();
const _decimalsCache = new Map<Currency, number>();

function getNativeDecimals(currency: Currency): number {
    const cached = _decimalsCache.get(currency);
    if (cached !== undefined) return cached;
    const d = new Intl.NumberFormat(CURRENCIES[currency].locale, {
        style: 'currency', currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
    _decimalsCache.set(currency, d);
    return d;
}

function getFormatter(currency: Currency, compact = false): Intl.NumberFormat {
    const key = `${currency}:${compact}`;
    const cached = _fmtCache.get(key);
    if (cached) return cached;

    const info = CURRENCIES[currency];
    // Explicitly set maximumFractionDigits to the currency's ISO 4217 native
    // decimal count so that compact notation can't override it for small values
    // (e.g. JPY/KRW would show ¥6.4 instead of ¥6 without this).
    const fmt = new Intl.NumberFormat(info.locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: getNativeDecimals(currency),
        ...(compact ? { notation: 'compact' as const, compactDisplay: 'short' as const } : {}),
    });
    _fmtCache.set(key, fmt);
    return fmt;
}

// ── Store (actions + persisted state only) ─────────────────────────────────────
interface CurrencyState {
    currency: Currency;
    rates: Record<Currency, number>;
    ratesUpdatedAt: number;
    setCurrency: (currency: Currency) => void;
    fetchRates: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>()(
    persist(
        (set, get) => ({
            currency: 'USD',
            rates: { ...FALLBACK_RATES },
            ratesUpdatedAt: 0,

            setCurrency: (currency) => set({ currency }),

            fetchRates: async () => {
                const { ratesUpdatedAt, rates } = get();
                const now = Date.now();

                // Skip if rates are fresh
                if (rates && now - ratesUpdatedAt < RATES_TTL_MS) return;

                try {
                    const res = await fetch(API_URL, { cache: 'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    if (json?.rates) {
                        set({
                            rates: json.rates as Record<Currency, number>,
                            ratesUpdatedAt: now,
                        });
                    } else {
                        throw new Error('Invalid API response: missing "rates" key');
                    }
                } catch {
                    // Offline or API error: keep fallback rates already in state
                }
            },
        }),
        {
            name: 'cardledger-currency',
            partialize: (state) => ({
                currency: state.currency,
                rates: state.rates,
                ratesUpdatedAt: state.ratesUpdatedAt,
            }),
        }
    )
);

// ── Reactive hooks ─────────────────────────────────────────────────────────────
// These subscribe to the store's reactive state so components re-render
// when currency or rates change.

export function useFormatPrice(): (usdAmount: number, opts?: { compact?: boolean }) => string {
    const currency = useCurrencyStore((s) => s.currency);
    const rates = useCurrencyStore((s) => s.rates);

    return useCallback(
        (usdAmount: number, opts?: { compact?: boolean }) => {
            const rate = rates[currency] ?? 1;
            return getFormatter(currency, opts?.compact).format(usdAmount * rate);
        },
        [currency, rates],
    );
}

export function useConvertFromUsd(): (usdAmount: number) => number {
    const currency = useCurrencyStore((s) => s.currency);
    const rates = useCurrencyStore((s) => s.rates);

    return useCallback(
        (usdAmount: number) => usdAmount * (rates[currency] ?? 1),
        [currency, rates],
    );
}

export function useConvertToUsd(): (foreignAmount: number, fromCurrency: Currency) => number {
    const rates = useCurrencyStore((s) => s.rates);

    return useCallback(
        (foreignAmount: number, fromCurrency: Currency) => {
            const rate = rates[fromCurrency];
            if (!rate) return foreignAmount;
            return foreignAmount / rate;
        },
        [rates],
    );
}

// ── SSR-safe hook ──────────────────────────────────────────────────────────────
const noopSubscribe = () => () => {};
export function useHydratedCurrency(): Currency {
    return useSyncExternalStore(
        noopSubscribe,
        () => useCurrencyStore.getState().currency,
        () => 'USD' as Currency,
    );
}
