'use client';
import { Button } from '@/src/components/ui/button';
import Link from 'next/link';
import { useAuthSession } from '@/src/providers/SessionProvider';

export function HomeAuthButtons() {
    const { data: session } = useAuthSession();

    if (session) {
        return (
            <Button asChild size='lg' variant='default' className='text-lg'>
                <Link href='/dashboard'>Go to Dashboard</Link>
            </Button>
        );
    }

    return (
        <Button asChild size='lg' variant='default' className='text-lg'>
            <Link href='/sign-in'>Get Started</Link>
        </Button>
    );
}
