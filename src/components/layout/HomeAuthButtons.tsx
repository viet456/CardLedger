'use client';
import { Button } from '@/src/components/ui/button';
import Link from 'next/link';
import { useAuthSession } from '@/src/providers/SessionProvider';

export function HomeAuthButtons() {
    const { data: session } = useAuthSession();

    if (session) {
        return (
            <Button asChild size='lg' variant='outline' className='h-11 w-52 text-base'>
                <Link href='/dashboard'>Go to Dashboard</Link>
            </Button>
        );
    }

    return (
        <Button asChild size='lg' variant='outline' className='h-11 w-52 text-base'>
            <Link href='/sign-in'>Get Started</Link>
        </Button>
    );
}
