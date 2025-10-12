import { Metadata } from 'next';
import CardPageView from './CardPageView';

export const metadata: Metadata = {
    title: 'All Cards | CardLedger',
    description:
        'Browse, search, and filter the entire Pokémon TCG database of over 19,000 cards. Find any card from any set.'
};

export default function CardsPage() {
    return <CardPageView />;
}
