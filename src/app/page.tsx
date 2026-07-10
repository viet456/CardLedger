import Image from 'next/image';
import { Button } from '@/src/components/ui/button';
import Link from 'next/link';
import { Metadata } from 'next';
import { HomeAuthButtons } from '../components/layout/HomeAuthButtons';
import { FadeInView } from '../components/layout/FadeInView';
import {
    BarChart3,
    CheckCircle2,
    Search,
    Zap,
    ChartNoAxesCombined,
    ArrowRight
} from 'lucide-react';
import { HeroAssetInspector } from '../components/layout/HeroAssetInspector';
import {
    PortfolioShowcase,
    DatabaseShowcase,
    SyncShowcase
} from '../components/layout/ShowcaseSections';

export const metadata: Metadata = {
    title: 'CardLedger: Your Pokémon TCG Collection Manager',
    description:
        'Track, manage, and browse your entire Pokémon TCG collection. Fast, modern, and powerful tools for every collector.'
};

export default function Home() {
    return (
        <div className='flex flex-col'>
            {/* Hero Section */}
            <section className='relative flex flex-col items-center gap-6 overflow-hidden py-12 text-center md:py-12'>
                {/* Background image behind hero text */}
                <div className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
                    <Image
                        src='/hero/dashboard-bg.avif'
                        alt=''
                        fill
                        unoptimized
                        sizes='100vw'
                        className='object-cover opacity-20 dark:opacity-15'
                    />
                    <div className='absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background' />
                </div>
                <div className='container mx-auto flex flex-col items-center gap-5 px-4'>
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

                    <div className='flex flex-col gap-3 sm:flex-row'>
                        <Button
                            asChild
                            size='lg'
                            className='h-11 w-52 px-6 text-base'
                        >
                            <Link href='/cards'>
                                Search Database <Search className='ml-2 h-4 w-4' />
                            </Link>
                        </Button>
                        <HomeAuthButtons />
                    </div>

                    <Link
                        href='/sets'
                        className='group mt-2 inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground backdrop-blur-sm transition-all duration-150 hover:bg-muted/70'
                    >
                        Browse Expansion Sets
                        <ArrowRight className='ml-1 h-3 w-3 transition-transform group-hover:translate-x-1' />
                    </Link>

                    <p className='mt-1 text-xs text-muted-foreground/70'>
                        ⚡ Featuring 21,000+ cards from every expansion
                    </p>
                </div>
            </section>

            {/* Interactive Inspector Section */}
            <section className='overflow-hidden'>
                <HeroAssetInspector />
            </section>

            {/* Features Section 1 */}
            <FadeInView>
                <section className='border-y border-border bg-muted/30'>
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
                                21,000+ cards with live pricing. Search, filter, and instantly add
                                to your collection. No manual entry, no spreadsheets—just click and
                                track.
                            </p>
                            <ul className='grid gap-2'>
                                {[
                                    '21,000+ cards with live market data',
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
            </FadeInView>

            {/* Features Section 2 */}
            <FadeInView>
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
                                    <h3 className='text-sm font-semibold'>Real-time Updates</h3>
                                    <p className='text-sm text-muted-foreground'>
                                        Market prices update every 24 hours.
                                    </p>
                                </div>
                            </div>
                            <div className='flex gap-3 rounded-lg border border-border p-3'>
                                <BarChart3 className='mt-0.5 h-4 w-4 shrink-0 text-purple-500' />
                                <div>
                                    <h3 className='text-sm font-semibold'>Portfolio Analytics</h3>
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
            </FadeInView>

            {/* Features Section 3: Offline & Sync */}
            <FadeInView>
                <section className='border-y border-border bg-muted/30'>
                    <div className='container mx-auto grid gap-8 px-4 py-16 md:grid-cols-2 md:items-center md:gap-12'>
                        <div className='flex flex-col gap-5'>
                            <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600'>
                                <CheckCircle2 className='h-5 w-5' />
                            </div>
                            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
                                Flawless offline mode.
                                <br />
                                <span className='text-muted-foreground'>
                                    Built for the convention floor.
                                </span>
                            </h2>
                            <p className='text-base text-muted-foreground'>
                                Cell service dead at the card show? No problem. CardLedger is
                                engineered with a local-first architecture. Browse the entire
                                21,000+ card catalog and manage your portfolio completely offline.
                            </p>
                            <ul className='grid gap-2'>
                                {[
                                    'Zero-latency local search and filtering',
                                    'Make edits offline; auto-sync when connected',
                                    'Real-time cross-device updates'
                                ].map((item) => (
                                    <li
                                        key={item}
                                        className='flex items-center gap-2 text-sm md:text-base'
                                    >
                                        <CheckCircle2 className='h-4 w-4 text-green-600' />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Visual Placeholder */}
                        <div className='relative overflow-hidden rounded-xl border border-border bg-background shadow-lg'>
                            <SyncShowcase />
                        </div>
                    </div>
                </section>
            </FadeInView>

            {/* Bottom CTA */}
            <FadeInView>
                <section className='border-t border-border'>
                    <div className='container mx-auto flex flex-col items-center gap-6 px-4 py-16 text-center'>
                        <h2 className='text-2xl font-bold tracking-tight md:text-4xl'>
                            Ready to organize your collection?
                        </h2>
                        <p className='max-w-[500px] text-base text-muted-foreground md:text-lg'>
                            Join other collectors who treat their hobby like the asset class it
                            is.
                        </p>
                        <div className='flex flex-col gap-3 sm:flex-row'>
                            <Button asChild size='lg' className='h-10 px-8 text-base'>
                                <Link href='/cards'>Start Cataloging Now</Link>
                            </Button>
                            <HomeAuthButtons />
                        </div>
                    </div>
                </section>
            </FadeInView>
        </div>
    );
}