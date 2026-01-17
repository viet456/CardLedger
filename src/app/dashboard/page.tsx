import { DashboardClient } from './_components/DashboardClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard | CardLedger',
    description: 'Manage your Pokémon card collection and track portfolio value.'
};

export default async function DashboardPage() {
    return <DashboardClient />;
}
