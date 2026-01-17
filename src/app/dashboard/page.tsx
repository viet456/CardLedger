import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortfolioValue } from '@/src/services/portfolioService';
import { DashboardClient } from './_components/DashboardClient';

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        redirect('/sign-in');
    }
    const portfolioHistory = await getPortfolioValue(session.user.id);

    return <DashboardClient portfolioHistory={portfolioHistory} />;
}
