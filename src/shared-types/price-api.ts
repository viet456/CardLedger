export type PriceHistoryDataPoint = {
    timestamp: Date | string;
    tcgNearMint: number | null;
    tcgLightlyPlayed: number | null;
    tcgModeratelyPlayed: number | null;
    tcgHeavilyPlayed: number | null;
    tcgDamaged: number | null;
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
        // OLD structure (keeping for backwards compatibility if needed)
        conditions?: {
            [key: string]: {
                price?: number | null;
            };
        };
    };
};

export type PriceHistoryDbRow = {
    cardId: string;
    timestamp: Date;
    tcgNearMint?: number | null;
    tcgLightlyPlayed?: number | null;
    tcgModeratelyPlayed?: number | null;
    tcgHeavilyPlayed?: number | null;
    tcgDamaged?: number | null;
    tcgNearMintVolume?: number | null;
    tcgLightlyPlayedVolume?: number | null;
    tcgModeratelyPlayedVolume?: number | null;
    tcgHeavilyPlayedVolume?: number | null;
    tcgDamagedVolume?: number | null;
};

export type MarketKey =
    | 'tcgNearMint'
    | 'tcgLightlyPlayed'
    | 'tcgModeratelyPlayed'
    | 'tcgHeavilyPlayed'
    | 'tcgDamaged';
export type VolumeKey =
    | 'tcgNearMintVolume'
    | 'tcgLightlyPlayedVolume'
    | 'tcgModeratelyPlayedVolume'
    | 'tcgHeavilyPlayedVolume'
    | 'tcgDamagedVolume';

export const conditionsMarketMap: { [key: string]: MarketKey } = {
    'Near Mint': 'tcgNearMint',
    'Lightly Played': 'tcgLightlyPlayed',
    'Moderately Played': 'tcgModeratelyPlayed',
    'Heavily Played': 'tcgHeavilyPlayed',
    Damaged: 'tcgDamaged'
};

export const conditionsVolumeMap: { [key: string]: VolumeKey } = {
    'Near Mint': 'tcgNearMintVolume',
    'Lightly Played': 'tcgLightlyPlayedVolume',
    'Moderately Played': 'tcgModeratelyPlayedVolume',
    'Heavily Played': 'tcgHeavilyPlayedVolume',
    Damaged: 'tcgDamagedVolume'
};
