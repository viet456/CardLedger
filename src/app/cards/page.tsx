'use client';
import { AdvancedSearch } from '@/src/components/search/AdvancedSearch';
import { CardDataInitializer } from '@/src/components/CardDataInitializer';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useMemo } from 'react';
import { DenormalizedCard } from '@/src/shared-types/card-index';

export default function CardsPage() {
    const { cards, artists, rarities, sets, types, subtypes, supertypes, status } = useCardStore();
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
            resistances: card.rs.map((id) => types[id])
        }));
    }, [cards, artists, rarities, sets, types, subtypes, supertypes]);
    const filterOptions = { rarities, types, subtypes, artists, sets };
    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' }
        //{ label: 'Card Number', value: 'num' }
    ];
    return (
        <div className='flex flex-grow'>
            <CardDataInitializer />
            {status.startsWith('ready') && (
                <AdvancedSearch
                    initialCards={denormalizedCards}
                    filterOptions={filterOptions}
                    sortOptions={allCardsSortOptions}
                    defaultSort={{ sortBy: 'rD', sortOrder: 'desc' }}
                />
            )}
            {status === 'loading' && <p>Loading card data...</p>}
        </div>
    );
}
