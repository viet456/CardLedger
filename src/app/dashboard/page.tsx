import { DashboardClient } from './_components/DashboardClient';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/src/lib/auth';

export const metadata: Metadata = {
    title: 'Dashboard | CardLedger',
    description: 'Manage your Pokémon card collection and track portfolio value.'
};

export default async function DashboardPage() {
    // 1. Force dynamic rendering by reading the incoming request headers
    const session = await auth.api.getSession({
        headers: await headers()
    });

    // 2. Safely bounce unauthenticated users before the page ever loads
    if (!session) {
        redirect('/sign-in');
    }

    return <DashboardClient />;
}