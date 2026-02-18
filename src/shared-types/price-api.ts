// External Pricing API Contracts

// Raw history entry from API
export type ApiHistoryEntry = {
    date: string; // ISO string
    market: number | string; // sometimes string from API
    volume: number | string | null;
};

// Condition-level history
export type ApiConditionHistory = {
    history: ApiHistoryEntry[];
};

// Full price history object
export type ApiPriceHistory = {
    // Example: conditions["Near Mint"]
    conditions?: Record<string, ApiConditionHistory | undefined>;

    // Example: variants["Holofoil"]["Near Mint"]
    variants?: Record<
        string, // variant name
        Record<string, ApiConditionHistory | undefined>
    >;
};

// Variant-level current pricing
export type ApiVariantData = {
    printing: string; // "Normal", "Holofoil", etc
    marketPrice: number | null;
    lowPrice: number | null;
    conditionUsed?: string; // usually "Near Mint"
};

// Current market summary
export type ApiCardPrices = {
    market?: number | null; // big text price
    low?: number | null;
    primaryPrinting?: string;
    lastUpdated?: string | Date;
};

// Full API card object
export type ApiCard = {
    cardNumber: string | number;
    name: string;

    printingsAvailable?: string[];

    priceHistory?: ApiPriceHistory;

    prices?: ApiCardPrices;

    variants?: Record<string, ApiVariantData>;
};

export interface CardPrices {
    tcgNearMint: number | null;
    tcgNormal: number | null;
    tcgHolo: number | null;
    tcgReverse: number | null;
    tcgFirstEdition: number | null;
}

// Application / Domain Types

export type MarketKey = 'tcgNearMint' | 'tcgNormal' | 'tcgHolo' | 'tcgReverse' | 'tcgFirstEdition';

// Historical DB row shape (domain representation)
export type PriceHistoryDataPoint = {
    timestamp: Date | string;
    tcgNearMint: number | null;
    tcgNormal: number | null;
    tcgHolo: number | null;
    tcgReverse: number | null;
    tcgFirstEdition: number | null;
};

// Current market stats shape
export interface MarketStats {
    prices: Record<string, CardPrices>;
}

// Variant Mapping Helpers

export type PriceColumn = 'tcgNormal' | 'tcgHolo' | 'tcgReverse' | 'tcgFirstEdition';

export interface VariantMapping {
    apiKeys: string[];
    dbColumn: PriceColumn;
}

// Canonical mapping between API variant names and DB columns
export const VARIANT_MAPPINGS: VariantMapping[] = [
    { apiKeys: ['Normal'], dbColumn: 'tcgNormal' },
    { apiKeys: ['Holofoil'], dbColumn: 'tcgHolo' },
    { apiKeys: ['Reverse Holofoil', 'Reverse'], dbColumn: 'tcgReverse' },
    { apiKeys: ['1st Edition', '1st Edition Holofoil'], dbColumn: 'tcgFirstEdition' }
];

// Simple lookup map (optional utility)
export const variantsMarketMap: Record<string, MarketKey> = {
    'Near Mint': 'tcgNearMint',
    Normal: 'tcgNormal',
    Holofoil: 'tcgHolo',
    'Reverse Holofoil': 'tcgReverse',
    Reverse: 'tcgReverse',
    '1st Edition': 'tcgFirstEdition',
    '1st Edition Holofoil': 'tcgFirstEdition'
};

export function resolveBestNearMint(
    nearMint: number | null | undefined,
    normal?: number | null,
    holo?: number | null,
    reverse?: number | null,
    firstEdition?: number | null
): number | null {
    return nearMint ?? normal ?? holo ?? reverse ?? firstEdition ?? null;
}
