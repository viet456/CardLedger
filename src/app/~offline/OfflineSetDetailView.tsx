'use client';

import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { SetPageView } from '@/src/app/sets/[setId]/SetPageView';
import { DenormalizedCard, FilterOptions } from '@/src/shared-types/card-index';
import { WifiOff } from 'lucide-react';

export function OfflineSetDetailView({ setId }: { setId: string }) {
    const hasHydrated = useHasHydrated();
    
    const { 
        sets, cardMap, setIndex, names, rarities, 
        types, subtypes, artists 
    } = useCardStore();
    const { prices } = useMarketStore();

    if (!hasHydrated) {
        return <div className="min-h-screen bg-muted/20 animate-pulse" />;
    }

    const setInfo = sets.find(s => s.id === setId);
    const cardIdsInSet = setIndex.get(setId);

    if (!setInfo || !cardIdsInSet) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-12 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold">Set Not Found Locally</h2>
                <p className="text-muted-foreground">This set isn&apos;t in your local index.</p>
            </div>
        );
    }

    const denormalizedCards: DenormalizedCard[] = Array.from(cardIdsInSet).map(cardId => {
        const card = cardMap.get(cardId)!;
        const marketData = prices[cardId];
        
        const price = marketData 
            ? (marketData.tcgNearMint || marketData.tcgNormal || marketData.tcgHolo || marketData.tcgReverse || marketData.tcgFirstEdition || null) 
            : null;

        return {
            id: card.id,
            n: names[card.n],
            num: card.num,
            hp: card.hp, 
            set: setInfo,
            rarity: card.r !== null ? rarities[card.r] : undefined,
            types: card.t.map(idx => types[idx]),
            subtypes: card.sb.map(idx => subtypes[idx]),
            artist: card.a !== null ? artists[card.a] : undefined,
            weaknesses: (card.w || []).map(w => ({ type: types[w.t], value: w.v })),
            resistances: (card.rs || []).map(r => ({ type: types[r.t], value: r.v })),
            price: price,
        } as DenormalizedCard;
    });

    // 3. Generate dynamic filter options exactly like the SSR page.tsx
    const filterOptions: FilterOptions = {
        artists: Array.from(new Set(denormalizedCards.map((c) => c.artist).filter(Boolean))).sort() as string[],
        rarities: Array.from(new Set(denormalizedCards.map((c) => c.rarity).filter(Boolean))).sort() as string[],
        types: Array.from(new Set(denormalizedCards.flatMap((c) => c.types))).sort(),
        subtypes: Array.from(new Set(denormalizedCards.flatMap((c) => c.subtypes))).sort(),
        weaknesses: Array.from(new Set(denormalizedCards.flatMap((c) => c.weaknesses?.map((w) => w.type) || []))).sort(),
        resistances: Array.from(new Set(denormalizedCards.flatMap((c) => c.resistances?.map((r) => r.type) || []))).sort()
    };

    return (
        <SetPageView 
            setInfo={setInfo} 
            cards={denormalizedCards} 
            filterOptions={filterOptions} 
        />
    );
}
