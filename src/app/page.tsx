import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
    return (
        <div className='container mx-auto flex flex-col items-center justify-center gap-16 px-4 py-16 text-center'>
            {/* Hero Section */}
            <section className='flex flex-col items-center gap-4'>
                <h1 className='text-4xl leading-[1.1] font-bold tracking-tight md:text-6xl'>
                    The Modern Way to Track Your Pokémon Collection
                </h1>
                <p className='max-w-[700px] text-2xl'>
                    Browse every card ever made and get ready for powerful collection management and
                    financial tools, coming soon.
                </p>
                <Button asChild size='lg' className='mt-4 text-lg'>
                    <Link href='/cards'>Explore the Card Catalog</Link>
                </Button>
            </section>

            {/* Features Section */}
            <section className='grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2'>
                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-2xl font-bold'>Personal Collections</h3>
                    <p className='text-muted-foreground'>
                        Create an account to log every card you own, track different versions, and
                        manage your personal portfolio.
                    </p>
                </div>
                <div className='flex flex-col items-center gap-2'>
                    <h3 className='text-2xl font-bold'>Investment Tracking</h3>
                    <p className='text-muted-foreground'>
                        Follow market values from trusted sources to see how your collection&apos;s
                        worth changes over time.
                    </p>
                </div>
            </section>
        </div>
    );
}
