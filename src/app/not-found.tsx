import Link from 'next/link';
import { Button } from '@/src/components/ui/button';

export default async function NotFound() {
    return (
        <div className='flex h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center'>
            <div className='space-y-2'>
                <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl'>404</h1>
                <h2 className='text-xl font-semibold tracking-tight'>Page Not Found</h2>
                <p className='max-w-[500px] text-muted-foreground'>
                    Sorry, we couldn&apos;t find the page you were looking for. It might have been
                    moved, deleted, or perhaps you just mistyped the URL.
                </p>
            </div>
            <Button asChild size='lg'>
                <Link href='/'>Return Home</Link>
            </Button>
        </div>
    );
}
