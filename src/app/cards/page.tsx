import { AdvancedSearch } from '@/src/components/search/AdvancedSearch';
import { CardDataInitializer } from '@/src/components/CardDataInitializer';
import { SortableKey } from '@/src/services/pokemonCardValidator';

export default function CardsPage() {
    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        //{ label: 'Pokedex Number', value: 'pS'  },
        { label: 'Card Number', value: 'num' }
    ];
    return (
        <div className='flex flex-grow'>
            <CardDataInitializer />
            <AdvancedSearch
                sortOptions={allCardsSortOptions}
                defaultSort={{ sortBy: 'rD', sortOrder: 'desc' }}
            />
        </div>
    );
}
