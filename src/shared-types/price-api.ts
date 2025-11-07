export type PriceHistoryDataPoint = {
    timestamp: Date;
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

// export type ApiEbayHistoryEntry = {
//     average: number | string;
//     count: number | string | null;
// }

export type ApiCard = {
    cardNumber: string | number;
    name: string;
    priceHistory: {
        conditions: { [key: string]: { history: ApiHistoryEntry[] } | undefined };
    };
    prices?: {
        conditions?: {
            [key: string]: {
                // "Near Mint", "Lightly Played", etc
                price?: number | null;
            };
        };
        lastUpdated?: Date | string;
    };
    // ebay?: {
    //     priceHistory: {
    //         [grade: string]:
    //             | {
    //                   //psa 8, 9, 10
    //                   [date: string]: ApiEbayHistoryEntry;
    //               }
    //             | undefined;
    //     };
    // };
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

    // psa8MedianPrice?: number | null;
    // psa9MedianPrice?: number | null;
    // psa10MedianPrice?: number | null;
    // psa8SaleCount?: number | null;
    // psa9SaleCount?: number | null;
    // psa10SaleCount?: number | null;
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

// type PsaMarketKey = 'psa8MedianPrice' | 'psa9MedianPrice' | 'psa10MedianPrice';
// type PsaVolumeKey = 'psa8SaleCount' | 'psa9SaleCount' | 'psa10SaleCount';

// const psaGradeMarketMap: { [key: string]: PsaMarketKey } = {
//     psa8: 'psa8MedianPrice',
//     psa9: 'psa9MedianPrice',
//     psa10: 'psa10MedianPrice'
// };

// const psaGradeVolumeMap: { [key: string]: PsaVolumeKey } = {
//     psa8: 'psa8SaleCount',
//     psa9: 'psa9SaleCount',
//     psa10: 'psa10SaleCount'
// };
