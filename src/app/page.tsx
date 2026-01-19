import { Button } from '@/src/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';
import { HomeAuthButtons } from '../components/layout/HomeAuthButtons';
import { BarChart3, CheckCircle2, Search, Zap, ChartNoAxesCombined } from 'lucide-react';

import { HeroAssetInspector } from '../components/layout/HeroAssetInspector';
import PortfolioShowcase from '../components/layout/PortfolioShowcase';
import DatabaseShowcase from '../components/layout/DatabaseShowcase';

export const metadata: Metadata = {
    title: 'CardLedger: Your Pokémon TCG Collection Manager',
    description:
        'Track, manage, and browse your entire Pokémon TCG collection. Fast, modern, and powerful tools for every collector.'
};

export default function Home() {
    return (
        <div className='flex flex-col'>
            {/* Hero Section */}
            <section className='container mx-auto flex flex-col items-center gap-6 px-4 py-12 text-center md:py-20'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='bg-muted/50 inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm'>
                        <span className='mr-2 flex h-2 w-2 rounded-full bg-emerald-500 shadow-2xl'></span>
                        Daily Price Sync • Active
                    </div>

                    <h1 className='max-w-[800px] text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl'>
                        The operating system <br />
                        <span className='bg-gradient-to-b from-zinc-900 to-zinc-300 bg-clip-text text-transparent dark:from-white dark:to-zinc-400'>
                            for serious collectors.
                        </span>
                    </h1>

                    <p className='max-w-[540px] text-base text-muted-foreground md:text-lg'>
                        Stop relying on manual spreadsheets. CardLedger automates your pricing,
                        tracks historical value, and organizes your assets in one place.
                    </p>
                </div>

                <div className='flex flex-col gap-3 sm:flex-row'>
                    <Button
                        asChild
                        variant={'secondary'}
                        className='hover:bg-muted/80 h-10 border border-border bg-accent px-6 text-sm font-medium text-accent-foreground hover:text-muted-foreground'
                    >
                        <Link href='/cards'>
                            Search Database <Search className='ml-2 h-4 w-4' />
                        </Link>
                    </Button>
                    <HomeAuthButtons />
                </div>

                {/* HERO IMAGE */}
                <div className='mt-8 w-full'>
                    <HeroAssetInspector />
                </div>
            </section>

            {/* Features Section 1 */}
            <section className='bg-muted/30 border-y border-border'>
                <div className='container mx-auto grid gap-8 px-4 py-16 md:grid-cols-2 md:items-center md:gap-12'>
                    <div className='flex flex-col gap-5'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600'>
                            <Search className='h-5 w-5' />
                        </div>
                        <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
                            Every card in our database.
                            <br />
                            <span className='text-muted-foreground'>
                                One click to your portfolio.
                            </span>
                        </h2>
                        <p className='text-base text-muted-foreground'>
                            20,000+ cards with live pricing. Search, filter, and instantly add to
                            your collection. No manual entry, no spreadsheets—just click and track.
                        </p>
                        <ul className='grid gap-2'>
                            {[
                                '20,000+ cards with live market data',
                                'Instant add-to-collection from any card',
                                'Advanced search and filtering by any attribute'
                            ].map((item) => (
                                <li
                                    key={item}
                                    className='flex items-center gap-2 text-sm md:text-base'
                                >
                                    <CheckCircle2 className='h-4 w-4 text-blue-600' />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {/* Visual Placeholder */}
                    <div className='relative overflow-hidden rounded-xl border border-border bg-background shadow-lg'>
                        <DatabaseShowcase />
                    </div>
                </div>
            </section>

            {/* Features Section 2 */}
            <section className='container mx-auto grid gap-8 px-4 py-16 md:grid-cols-2 md:items-center md:gap-12'>
                <div className='flex flex-col gap-5 md:pl-10'>
                    <div className='flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-purple-500/10 text-purple-600'>
                        <ChartNoAxesCombined className='h-5 w-5' />
                    </div>
                    <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
                        Watch your portfolio grow.
                    </h2>
                    <p className='text-base text-muted-foreground'>
                        We pull market data daily so you know exactly what your cards are worth.
                        Spot trends before they happen.
                    </p>
                    <div className='grid gap-3 pt-2'>
                        <div className='flex gap-3 rounded-lg border border-border p-3'>
                            <Zap className='mt-0.5 h-4 w-4 text-yellow-500' />
                            <div>
                                <h4 className='text-sm font-semibold'>Real-time Updates</h4>
                                <p className='text-sm text-muted-foreground'>
                                    Market prices update every 24 hours.
                                </p>
                            </div>
                        </div>
                        <div className='flex gap-3 rounded-lg border border-border p-3'>
                            <BarChart3 className='mt-0.5 h-4 w-4 shrink-0 text-purple-500' />
                            <div>
                                <h4 className='text-sm font-semibold'>Portfolio Analytics</h4>
                                <p className='text-sm text-muted-foreground'>
                                    Visualize your collection&apos;s total value over time.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visual Placeholder */}
                <div className='relative overflow-hidden rounded-xl border border-border bg-background shadow-lg md:order-first'>
                    <PortfolioShowcase />
                </div>
            </section>

            <section className='bg-muted/50 border-t border-border'>
                <div className='container mx-auto flex flex-col items-center gap-6 px-4 py-16 text-center'>
                    <h2 className='text-2xl font-bold tracking-tight md:text-4xl'>
                        Ready to organize your collection?
                    </h2>
                    <p className='max-w-[500px] text-base text-muted-foreground md:text-lg'>
                        Join other collectors who treat their hobby like the asset class it is.
                    </p>
                    <div className='flex gap-4'>
                        <Button asChild size='lg' className='h-10 px-8 text-base'>
                            <Link href='/cards'>Start Cataloging Now</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
