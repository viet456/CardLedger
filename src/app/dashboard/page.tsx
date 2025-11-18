'use client';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/src/lib/auth-client';
import { useEffect } from 'react';

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !session?.user) {
            router.push('/sign-in');
        }
    }, [isPending, session, router]);

    if (isPending) return <p className='mt-8 text-center text-foreground'>Loading...</p>;
    if (!session?.user) return <p className='mt-8 text-center text-foreground'>Redirecting...</p>;

    const { user } = session;

    return (
        <main className='mx-auto flex h-screen max-w-md flex-col items-center justify-center space-y-4 p-6 text-foreground'>
            <h1 className='text-2xl font-bold'>Dashboard</h1>
            <p>Welcome, {user.username || 'User'}!</p>
        </main>
    );
}
