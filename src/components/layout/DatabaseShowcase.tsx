'use client';
import { useRef, useEffect, useState } from 'react';
import { CheckCircle2, Database, Zap, Clock } from 'lucide-react';
import { PokemonCard } from '../cards/PokemonCard';

const STATS = [
    { value: '20,000+', label: 'Cards', icon: Database },
    { value: '24hrs', label: 'Price Updates', icon: Clock },
    { value: '1998', label: 'Earliest Set', icon: Zap }
];

const SHOWCASE_CARDS = [
    {
        id: 'neo1-9',
        n: 'Lugia',
        img: 'cards/neo1-9',
        price: 482.24,
        rarity: 'Holo Rare',
        set: { name: 'Neo Genesis', printedTotal: 111 },
        num: '9',
        year: 2000
    },
    {
        id: 'ex8-102',
        n: 'Rayquaza ex',
        img: 'cards/ex8-102',
        price: 239.99,
        rarity: 'Rare Holo EX',
        set: { name: 'Deoxys', printedTotal: 108 },
        num: '102',
        year: 2005
    },
    {
        id: 'ex13-8',
        n: 'Gyarados δ',
        img: 'cards/ex13-8',
        price: 349.99,
        rarity: 'Rare Holo',
        set: { name: 'Holon Phantoms', printedTotal: 110 },
        num: '8',
        year: 2006
    },
    {
        id: 'smp-SM168',
        n: 'Pikachu & Zekrom GX',
        img: 'cards/smp-SM168',
        price: 153.75,
        rarity: 'Promo',
        set: { name: 'SM Black Star Promos', printedTotal: 248 },
        num: 'SM168',
        year: 2017
    },
    {
        id: 'swsh12pt5gg-GG69',
        n: 'Giratina VSTAR',
        img: 'cards/swsh12pt5gg-GG69',
        price: 192.43,
        rarity: 'Rare Secret',
        set: { name: 'Lost Origin', printedTotal: 70 },
        num: 'GG69',
        year: 2023
    },
    {
        id: 'me1-184',
        n: "Lillie's Determination",
        img: 'cards/me1-184',
        price: 72.87,
        rarity: 'Special Illustration Rare',
        set: { name: 'Mega Evolutions', printedTotal: 132 },
        num: '184',
        year: 2025
    }
] as any[];

const DATA_POINTS = [
    {
        label: 'Full card metadata',
        items: ['HP, Attacks, Abilities', 'Types & Weaknesses', 'Artist & Set Info']
    },
    {
        label: 'Complete pricing history',
        items: ['Daily market snapshots', 'All condition grades', 'Historical trends']
    },
    {
        label: 'Instant search & filter',
        items: ['By name, set, or artist', 'Type, rarity, year', 'Advanced combinations']
    }
];

export default function DatabaseShowcase() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollHeight, setScrollHeight] = useState(0);

    const scrollerCards = [...SHOWCASE_CARDS, ...SHOWCASE_CARDS, ...SHOWCASE_CARDS];

    useEffect(() => {
        if (scrollRef.current) {
            // Measure the height of one complete set
            const container = scrollRef.current;
            const firstCard = container.querySelector('[data-card-index="0"]');
            const lastCardOfFirstSet = container.querySelector(
                `[data-card-index="${SHOWCASE_CARDS.length - 1}"]`
            );

            if (firstCard && lastCardOfFirstSet) {
                const firstRect = firstCard.getBoundingClientRect();
                const lastRect = lastCardOfFirstSet.getBoundingClientRect();
                // Calculate total height of one set including the gap after the last card
                const oneSetHeight = lastRect.bottom - firstRect.top + 20; // 20px is gap-5 (1.25rem)
                setScrollHeight(oneSetHeight);
            }
        }
    }, []);

    return (
        <div className='relative flex h-full min-h-[350px] w-full flex-col gap-6 overflow-hidden bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent p-6 md:min-h-[500px]'>
            <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20' />

            {/* Stats Header */}
            <div className='relative z-10 grid grid-cols-3 gap-3'>
                {STATS.map((stat, i) => (
                    <div
                        key={i}
                        className='rounded-lg border border-border bg-background/80 p-3 text-center backdrop-blur-sm'
                    >
                        <stat.icon className='mx-auto mb-1 h-4 w-4 text-blue-500' />
                        <div className='font-mono text-lg font-bold'>{stat.value}</div>
                        <div className='text-xs text-muted-foreground'>{stat.label}</div>
                    </div>
                ))}
            </div>

            <div className='relative z-10 grid flex-1 gap-8 overflow-hidden md:grid-cols-2'>
                {/* LEFT PANEL: The Infinite Card Stream */}
                <div className='relative hidden h-[450px] overflow-hidden md:block'>
                    <div className='pointer-events-none absolute inset-0 z-20 [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]' />

                    <div className='absolute inset-0 flex justify-center py-4'>
                        <div
                            ref={scrollRef}
                            className='scroll-container flex w-[280px] flex-col gap-5 px-4'
                            style={
                                {
                                    '--scroll-height': `${scrollHeight}px`
                                } as React.CSSProperties
                            }
                        >
                            {scrollerCards.map((card, i) => (
                                <div
                                    key={`${card.id}-${i}`}
                                    data-card-index={i}
                                    className='transform cursor-pointer transition-transform duration-300 hover:z-10 hover:scale-105'
                                >
                                    <PokemonCard card={card} priority={false} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Feature List */}
                <div className='flex flex-col justify-center gap-6'>
                    <div className='space-y-3'>
                        {DATA_POINTS.map((section, i) => (
                            <div
                                key={i}
                                className='group rounded-lg border border-border bg-background/60 p-4 backdrop-blur-sm transition-colors hover:bg-background/80'
                            >
                                <div className='mb-2 flex items-center gap-3'>
                                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 transition-colors group-hover:bg-blue-500/20'>
                                        <CheckCircle2 className='h-4 w-4 text-blue-600' />
                                    </div>
                                    <div className='text-sm font-medium'>{section.label}</div>
                                </div>
                                <div className='ml-11 flex flex-wrap gap-x-3 gap-y-1'>
                                    {section.items.map((item, j) => (
                                        <span
                                            key={j}
                                            className='flex items-center gap-1.5 text-sm text-muted-foreground'
                                        >
                                            <span className='h-1 w-1 rounded-full bg-blue-500/40' />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .scroll-container {
                    animation: scroll-vertical 30s linear infinite;
                }

                .scroll-container:hover {
                    animation-play-state: paused;
                }

                @keyframes scroll-vertical {
                    0% {
                        transform: translateY(0);
                    }
                    100% {
                        /* Move by exactly one set of cards */
                        transform: translateY(calc(-1 * var(--scroll-height, 0px)));
                    }
                }
            `}</style>
        </div>
    );
}
