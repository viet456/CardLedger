'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useMemo } from 'react';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { useCardFilters } from '@/hooks/useCardFilters';
import { CardGrid } from '@/src/components/cards/CardGrid';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { PokemonCardSkeleton } from '@/src/components/cards/PokemonCardSkeleton';

export default function CardPageView() {
    const isHydrated = useHasHydrated();
    const {
        cards,
        artists,
        rarities,
        sets,
        types,
        subtypes,
        supertypes,
        abilities,
        attacks,
        rules,
        status
    } = useCardStore();
    const { prices } = useMarketStore();

    const denormalizedCards: DenormalizedCard[] = useMemo(() => {
        if (!cards || cards.length === 0) return [];
        return cards.map((card) => ({
            id: card.id,
            n: card.n,
            hp: card.hp,
            num: card.num,
            img: card.img,
            pS: card.pS,
            cRC: card.cRC,
            artist: card.a !== null ? artists[card.a] : null,
            rarity: card.r !== null ? rarities[card.r] : null,
            set: sets[card.s],
            supertype: supertypes[card.st],
            subtypes: card.sb.map((id) => subtypes[id]),
            types: card.t.map((id) => types[id]),
            weaknesses: (card.w || []).map((w) => ({ type: types[w.t], value: w.v })),
            resistances: (card.rs || []).map((r) => ({ type: types[r.t], value: r.v })),
            abilities: (card.ab || []).map((id) => abilities[id]),
            pokedexNumbers: card.pdx,
            ancientTrait: card.aT ? { name: card.aT.n, text: card.aT.t } : null,
            rules: (card.ru || []).map((id) => rules[id]),
            attacks: (card.ak || []).map((id) => attacks[id]),
            evolvesFrom: card.eF,
            evolvesTo: card.eT || [],
            legalities: {
                standard: card.leg?.s,
                expanded: card.leg?.e,
                unlimited: card.leg?.u
            },
            price: prices[card.id] ?? null
        }));
    }, [
        cards,
        artists,
        rarities,
        sets,
        types,
        subtypes,
        supertypes,
        abilities,
        attacks,
        rules,
        prices
    ]);
    const filterOptions = { rarities, types, subtypes, artists, sets };
    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
        //{ label: 'Card Number', value: 'num' }
    ];
    const defaultSort = { sortBy: 'rD' as SortableKey, sortOrder: 'desc' as const };
    const isLoading = !isHydrated || !status.startsWith('ready');

    const { filteredCards } = useCardFilters({ initialCards: denormalizedCards, defaultSort });

    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* <CardDataInitializer /> */}
            <CardFilterControls filterOptions={filterOptions} sortOptions={allCardsSortOptions} />
            <div className='mt-2 min-h-screen flex-grow'>
                {isLoading ? (
                    <div className='grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <PokemonCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <CardGrid cards={filteredCards} totalCount={filteredCards.length} />
                )}
            </div>
        </div>
    );
}
