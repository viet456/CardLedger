'use client';

import { useMemo } from 'react';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { resolveBestNearMint } from '@/src/shared-types/price-api';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useCardStore } from '@/src/lib/store/cardStore';
import { CardVariant } from '@/prisma/generated/enums';

export type ProgressRow = {
    label: string;
    owned: number;
    total: number;
};

export type SetCollectionStats = {
    totalCollected: number;
    setTotal: number;
    marketValue: number;
    costBasis: number;
    overallProgress: ProgressRow;
    variantProgress: ProgressRow[];
    rarityProgress: ProgressRow[];
    artistProgress: ProgressRow[];
    isLoading: boolean;
};

export function useSetCollectionStats(setId: string): SetCollectionStats {
    const collectionStatus = useCollectionStore((s) => s.status);
    const entries = useCollectionStore((s) => s.entries);
    const prices = useMarketStore((s) => s.prices);

    const cardMap = useCardStore((s) => s.cardMap);
    const setIndex = useCardStore((s) => s.setIndex);
    const rarities = useCardStore((s) => s.rarities);
    const artists = useCardStore((s) => s.artists);

    // Get NormalizedCards for this set from the store indexes
    const setCards: NormalizedCard[] = useMemo(() => {
        const ids = setIndex.get(setId);
        if (!ids) return [];
        return Array.from(ids)
            .map((id) => cardMap.get(id))
            .filter((c): c is NonNullable<typeof c> => c !== undefined)
            .sort((a, b) => (a._index ?? 0) - (b._index ?? 0));
    }, [setId, setIndex, cardMap]);

    const stats = useMemo(() => {
        // Build a set of cardIds in this set for fast lookup
        const setCardIds = new Set(setCards.map((c) => c.id));

        // Filter collection entries to only those belonging to this set
        const setEntries = entries.filter((e) => setCardIds.has(e.cardId));

        // Deduplicated set of unique cardIds owned in this set
        const uniqueCardIds = new Set(setEntries.map((e) => e.cardId));
        const uniqueCount = uniqueCardIds.size;
        const setTotal = setCards.length;

        // Market value: for each unique owned card, pick the best available price
        let marketValue = 0;
        for (const cardId of uniqueCardIds) {
            const cardPrices = prices[cardId];
            if (cardPrices) {
                const price = resolveBestNearMint(
                    cardPrices.tcgNearMint,
                    cardPrices.tcgNormal,
                    cardPrices.tcgHolo,
                    cardPrices.tcgReverse,
                    cardPrices.tcgFirstEdition
                );
                if (price !== null) {
                    marketValue += price;
                }
            }
        }

        // Cost basis: sum of purchasePrice for all entries in this set
        const costBasis = setEntries.reduce((sum, e) => sum + e.purchasePrice, 0);

        // --- Overall Progress ---
        const overallProgress: ProgressRow = {
            label: 'Unique cards owned',
            owned: uniqueCount,
            total: setTotal,
        };

        // --- Variant Progress ---
        const variantTypes: { label: string; flag: keyof NormalizedCard; variant: CardVariant }[] = [
            { label: 'Normal', flag: 'hasNormal', variant: 'Normal' },
            { label: 'Holo', flag: 'hasHolo', variant: 'Holo' },
            { label: 'Reverse Holo', flag: 'hasReverse', variant: 'Reverse' },
            { label: '1st Edition', flag: 'hasFirstEdition', variant: 'FirstEdition' },
        ];

        const variantProgress: ProgressRow[] = [];
        for (const vt of variantTypes) {
            const cardsWithVariant = setCards.filter((c) => c[vt.flag]);
            if (cardsWithVariant.length === 0) continue;

            const cardsWithVariantIds = new Set(cardsWithVariant.map((c) => c.id));
            const ownedWithVariant = new Set(
                setEntries
                    .filter((e) => e.variant === vt.variant && cardsWithVariantIds.has(e.cardId))
                    .map((e) => e.cardId)
            );

            variantProgress.push({
                label: vt.label,
                owned: ownedWithVariant.size,
                total: cardsWithVariant.length,
            });
        }

        // --- Rarity Progress ---
        const rarityMap = new Map<string, { total: number; owned: Set<string> }>();
        for (const card of setCards) {
            const rarity = (card.r !== null ? rarities[card.r] : null) ?? 'Unknown';
            if (!rarityMap.has(rarity)) {
                rarityMap.set(rarity, { total: 0, owned: new Set() });
            }
            rarityMap.get(rarity)!.total++;
            if (uniqueCardIds.has(card.id)) {
                rarityMap.get(rarity)!.owned.add(card.id);
            }
        }

        const rarityProgress: ProgressRow[] = Array.from(rarityMap.entries())
            .map(([label, data]) => ({ label, owned: data.owned.size, total: data.total }))
            .sort((a, b) => a.label.localeCompare(b.label));

        // --- Artist Progress ---
        const artistMap = new Map<string, { total: number; owned: Set<string> }>();
        for (const card of setCards) {
            const artist = (card.a !== null ? artists[card.a] : null) ?? 'Unknown';
            if (!artistMap.has(artist)) {
                artistMap.set(artist, { total: 0, owned: new Set() });
            }
            artistMap.get(artist)!.total++;
            if (uniqueCardIds.has(card.id)) {
                artistMap.get(artist)!.owned.add(card.id);
            }
        }

        const artistProgress: ProgressRow[] = Array.from(artistMap.entries())
            .map(([label, data]) => ({ label, owned: data.owned.size, total: data.total }))
            .sort((a, b) => b.total - a.total);

        return {
            totalCollected: uniqueCount,
            setTotal,
            marketValue,
            costBasis,
            overallProgress,
            variantProgress,
            rarityProgress,
            artistProgress,
            isLoading: collectionStatus === 'loading' || collectionStatus === 'idle',
        };
    }, [setCards, entries, prices, collectionStatus, rarities, artists]);

    return stats;
}