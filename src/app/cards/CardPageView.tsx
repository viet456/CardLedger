'use client';
import { CardDataInitializer } from '@/src/components/CardDataInitializer';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useMemo } from 'react';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { useCardFilters } from '@/src/hooks/useCardFilters';
import { CardGrid } from '@/src/components/cards/CardGrid';
import { useHasHydrated } from '@/src/hooks/useHasHydrated';

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
            }
        }));
    }, [cards, artists, rarities, sets, types, subtypes, supertypes, abilities, attacks, rules]);
    const filterOptions = { rarities, types, subtypes, artists, sets };
    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' }
        //{ label: 'Card Number', value: 'num' }
    ];
    const defaultSort = { sortBy: 'rD' as SortableKey, sortOrder: 'desc' as const };
    const isLoading = !isHydrated || !status.startsWith('ready');

    const { filteredCards } = useCardFilters({ initialCards: denormalizedCards, defaultSort });

    return (
        <div className='w-full'>
            <CardDataInitializer />
            <CardFilterControls filterOptions={filterOptions} sortOptions={allCardsSortOptions} />
            <div className='mt-2'>
                <CardGrid
                    cards={filteredCards}
                    totalCount={isLoading ? 20 : filteredCards.length}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}
