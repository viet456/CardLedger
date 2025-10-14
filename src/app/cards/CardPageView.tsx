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
    const { cards, artists, rarities, sets, types, subtypes, supertypes, abilities, status } =
        useCardStore();
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
            weaknesses: card.w.map((id) => types[id]),
            resistances: card.rs.map((id) => types[id]),
            // Empty array fallback for old Json without abilities
            abilities: (card.ab || []).map((id) => abilities[id])
        }));
    }, [cards, artists, rarities, sets, types, subtypes, supertypes, abilities]);
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
