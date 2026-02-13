export type PriceHistoryDataPoint = {
    timestamp: Date | string;
    tcgNearMint: number | null;
    tcgNormal: number | null;
    tcgHolo: number | null;
    tcgReverse: number | null;
    tcgFirstEdition: number | null;
};

export type MarketStats = {
    prices: Record<string, number>;
};

export type ApiHistoryEntry = {
    date: string;
    market: number | string;
    volume: number | string | null;
};

export type ApiCard = {
    cardNumber: string | number;
    name: string;
    printingsAvailable?: string[];
    variants?: {
        [variantName: string]: {
            printing: string;
            marketPrice: number | null;
            lowPrice: number | null;
            conditionUsed?: string; // "Near Mint"
        };
    };
    priceHistory: {
        conditions: { [key: string]: { history: ApiHistoryEntry[] } | undefined };
    };
    prices?: {
        market?: number;
        low?: number;
        primaryPrinting?: string;
        lastUpdated?: Date | string;
        variants?: {
            [printingType: string]: {
                [conditionName: string]: {
                    price?: number | null;
                    listings?: number | null;
                    priceString?: string;
                    lastUpdated?: Date | string;
                };
            };
        };
    };
};

export type PriceHistoryDbRow = {
    cardId: string;
    timestamp: Date;
    tcgNearMint?: number | null;
    tcgNormal?: number | null;
    tcgHolo?: number | null;
    tcgReverse?: number | null;
    tcgFirstEdition?: number | null;
};

export type MarketKey =
    | 'tcgNearMint'
    | 'tcgNormal'
    | 'tcgHolo'
    | 'tcgReverse'
    | 'tcgFirstEdition';

export const conditionsMarketMap: { [key: string]: MarketKey } = {
    'Near Mint': 'tcgNearMint',
    'Normal': 'tcgNormal',
    'Holofoil': 'tcgHolo',
    'Reverse Holofoil': 'tcgReverse',
    'First Edition': 'tcgFirstEdition'
};
