'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
    Search,
    Layers,
    Paintbrush,
    Zap,
    PenTool,
    Heart,
    Brush,
    Shield,
    MoveRight,
    XCircle,
    TrendingUp,
    MousePointer2,
    ArrowUpRight,
    ScanFace
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

type Hotspot = {
    id: string;
    label: string;
    icon: any;
    top: string;
    left: string;
    width: string;
    height: string;
};

interface AssetCardProps {
    image: string;
    name: string;
    id: string;
    price: string;
    trend: string;
    hotspots: Hotspot[];
    className?: string;
    side?: 'left' | 'right';
    specs?: { label: string; value: string }[];
    priority?: boolean;
}

export function HeroAssetInspector() {
    return (
        <div className='relative -mx-4 overflow-hidden sm:-mx-8 md:py-32'>
            {/*  3D BACKGROUND LAYER */}
            <div className='pointer-events-none absolute -top-[12%] left-1/2 -z-10 w-[150%] max-w-none -translate-x-1/2 select-none bg-zinc-900 opacity-100'>
                {' '}
                <div
                    className='relative aspect-[1/2.2] w-full origin-top transform-gpu md:aspect-[2/1]'
                    style={{
                        // Perspective + Rotation
                        transform: 'perspective(1200px) rotateX(10deg)  scale(0.65)'
                    }}
                >
                    {/* The Image */}
                    <div className='relative h-full w-full rounded-xl border border-white/10 bg-zinc-900 shadow-2xl'>
                        <Image
                            src='/hero/dashboard-bg.avif'
                            unoptimized
                            alt='CardLedger Interface'
                            fill
                            className='object-cover'
                            fetchPriority='high'
                            preload={true}
                        />
                    </div>

                    {/* GRADIENT MASKS: These fade the edges so it blends into the page */}
                    {/* Fade bottom to bg color) */}
                    <div className='via-background/60 absolute inset-0 bg-gradient-to-b from-transparent to-background' />
                </div>
            </div>

            {/* THE LABEL */}
            <div className='bg-muted/80 absolute bottom-10 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground shadow-sm backdrop-blur-md md:flex'>
                <MousePointer2 className='h-3.5 w-3.5' />
                <span>Interactive Inspection Active</span>
            </div>

            {/* MOBILE LABEL */}
            <div className='absolute right-8 top-2 flex items-center gap-1.5 md:hidden'>
                <span className='text-[10px] font-medium uppercase tracking-widest text-white'>
                    Tap to inspect
                </span>
                <ScanFace className='text-muted-foreground/60 h-3 w-3' />
            </div>

            {/* THE CARDS */}
            <div className='relative z-10 flex h-full w-full snap-x snap-mandatory items-start gap-4 overflow-x-auto px-8 pb-56 pt-8 [scrollbar-width:none] md:items-center md:justify-center md:gap-16 md:overflow-visible md:p-0'>
                <SchematicCard
                    side='left'
                    priority={true}
                    className='z-10 shrink-0 snap-center'
                    image='cards/base1-4'
                    name='Charizard'
                    id='base1-4'
                    price='$488.02'
                    trend='+0.0%'
                    specs={[
                        { label: 'Condition', value: 'Ungraded (NM)' },
                        { label: 'Set', value: 'Base Set (1999)' }
                    ]}
                    hotspots={[
                        {
                            id: 'type',
                            label: 'Fire Type',
                            icon: Zap,
                            top: '5%',
                            left: '85.5%',
                            width: '8%',
                            height: '6%'
                        },
                        {
                            id: 'hp',
                            label: '120 HP',
                            icon: Zap,
                            top: '5%',
                            left: '66%',
                            width: '19.5%',
                            height: '6%'
                        },
                        {
                            id: 'name',
                            label: 'Charizard',
                            icon: Search,
                            top: '5.5%',
                            left: '23.5%',
                            width: '32%',
                            height: '6%'
                        },
                        {
                            id: 'art',
                            label: 'Rare Holo',
                            icon: Paintbrush,
                            top: '12%',
                            left: '10%',
                            width: '81%',
                            height: '40%'
                        },
                        {
                            id: 'weakness',
                            label: 'Weakness: Water',
                            icon: XCircle,
                            top: '83%',
                            left: '8%',
                            width: '14.5%',
                            height: '6.5%'
                        },
                        {
                            id: 'resistance',
                            label: 'Resistance: Fighting',
                            icon: Shield,
                            top: '83%',
                            left: '43%',
                            width: '18%',
                            height: '6.5%'
                        },
                        {
                            id: 'retreat',
                            label: 'Retreat Cost: 3',
                            icon: MoveRight,
                            top: '83%',
                            left: '76%',
                            width: '19%',
                            height: '6.5%'
                        },
                        {
                            id: 'artist',
                            label: 'Mitsuhiro Arita',
                            icon: PenTool,
                            top: '94%',
                            left: '2%',
                            width: '23%',
                            height: '4.5%'
                        }
                    ]}
                />

                <SchematicCard
                    side='right'
                    priority={true}
                    className='z-10 shrink-0 snap-center'
                    image='cards/swsh7-215'
                    name='Umbreon VMAX'
                    id='swsh7-215'
                    price='$1771.37'
                    trend='+8.4%'
                    specs={[
                        { label: 'Condition', value: 'Ungraded (NM)' },
                        { label: 'Set', value: 'Evolving Skies' }
                    ]}
                    hotspots={[
                        {
                            id: 'set',
                            label: 'Evolving Skies',
                            icon: Layers,
                            top: '93%',
                            left: '5%',
                            width: '6%',
                            height: '4%'
                        },
                        {
                            id: 'artist',
                            label: 'Keiichiro Ito',
                            icon: PenTool,
                            top: '90.5%',
                            left: '5%',
                            width: '22%',
                            height: '4%'
                        },
                        {
                            id: 'type',
                            label: 'Darkness Type',
                            icon: Zap,
                            top: '3%',
                            left: '87%',
                            width: '9%',
                            height: '6.5%'
                        },
                        {
                            id: 'hp',
                            label: '310 HP',
                            icon: Heart,
                            top: '3%',
                            left: '71%',
                            width: '16%',
                            height: '6.5%'
                        },
                        {
                            id: 'art',
                            label: 'Alt Art',
                            icon: Brush,
                            top: '15%',
                            left: '10%',
                            width: '80%',
                            height: '50%'
                        },
                        {
                            id: 'weakness',
                            label: 'Weakness: Grass',
                            icon: XCircle,
                            top: '84%',
                            left: '4%',
                            width: '22%',
                            height: '6%'
                        },
                        {
                            id: 'resistance',
                            label: 'Resistance: None',
                            icon: Shield,
                            top: '84%',
                            left: '30%',
                            width: '22%',
                            height: '6%'
                        },
                        {
                            id: 'retreat',
                            label: 'Retreat Cost: 2',
                            icon: MoveRight,
                            top: '84%',
                            left: '60%',
                            width: '22%',
                            height: '6%'
                        },
                        {
                            id: 'name',
                            label: 'Umbreon VMAX',
                            icon: Search,
                            top: '3%',
                            left: '17.5%',
                            width: '45%',
                            height: '6%'
                        }
                    ]}
                />
            </div>
        </div>
    );
}
function SchematicCard({
    image,
    name,
    id,
    price,
    trend,
    hotspots,
    className,
    side = 'right',
    specs = [],
    priority = false
}: AssetCardProps) {
    return (
        <div
            className={cn(
                'group relative flex w-[300px] cursor-default flex-col items-center md:block md:h-[420px]',
                className
            )}
        >
            {/* IMAGE CONTAINER */}
            <Link
                href={`/cards/${id}`}
                className='group relative block h-[420px] w-full shrink-0 transition-transform duration-300'
                prefetch={true} // Explicitly ensure prefetch is on
                onClick={(e) => {
                    // Check if the user is on mobile
                    if (window.innerWidth < 768) {
                        // Check if the click originated from the Info HUD (which has data-clickable="true")
                        const isHudClick = (e.target as Element).closest('[data-clickable="true"]');

                        // If they clicked the Image/Hotspots (NOT the HUD), stop navigation
                        if (!isHudClick) {
                            e.preventDefault();
                        }
                    }
                }}
            >
                <div className='relative h-[420px] w-full shrink-0 rounded-2xl border border-border bg-background shadow-2xl transition-colors duration-300 hover:border-emerald-500/30'>
                    <div className='relative h-full w-full overflow-hidden rounded-2xl'>
                        <Image
                            src={`${R2_PUBLIC_URL}/${image}`}
                            alt={name}
                            fill
                            sizes='512px'
                            className='object-cover'
                            preload={priority}
                            fetchPriority='high'
                            loading='eager'
                        />
                        <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]' />
                    </div>

                    {/* HOTSPOTS */}
                    <div className='absolute inset-0'>
                        {hotspots.map((spot) => (
                            <div
                                key={spot.id}
                                className='group/spot absolute z-20'
                                style={{
                                    top: spot.top,
                                    left: spot.left,
                                    width: spot.width,
                                    height: spot.height
                                }}
                            >
                                <div className='absolute inset-0 rounded border border-white/20 bg-white/5 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover/spot:border-2 group-hover/spot:border-emerald-400 group-hover/spot:bg-emerald-500/10 group-hover/spot:opacity-100' />
                                <div className='absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2 border-white opacity-60' />
                                <div className='absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2 border-white opacity-60' />
                                <div className='absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-white opacity-60' />
                                <div className='absolute -bottom-px -left-px h-2 w-2.5 border-b-2 border-l-2 border-white opacity-60' />

                                <div className='pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap opacity-0 transition-all duration-200 group-hover/spot:-translate-y-1 group-hover/spot:opacity-100'>
                                    <div className='flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground shadow-xl backdrop-blur-md'>
                                        <spot.icon className='h-3.5 w-3.5 text-emerald-400' />
                                        {spot.label}
                                    </div>
                                    <div className='absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-emerald-500/30 bg-card' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* INFO HUD */}
                <div
                    data-clickable='true'
                    className={cn(
                        'z-0 mt-2 w-full md:absolute md:top-8 md:mt-0 md:w-[160px]',
                        side === 'left' ? 'md:right-[105%] md:pr-2' : 'md:left-[105%] md:pl-2'
                    )}
                >
                    {/* Connector Line (Desktop) */}
                    <div
                        className={cn(
                            'absolute top-6 hidden h-px w-4 bg-card md:block',
                            side === 'left' ? 'right-0' : 'left-0'
                        )}
                    />

                    <div className='flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-xl backdrop-blur-sm'>
                        <div className='group/link flex items-center justify-between'>
                            <p className='text-lg font-medium leading-tight text-card-foreground decoration-dotted underline-offset-4 group-hover:underline'>
                                {name}
                            </p>
                            <ArrowUpRight className='h-3.5 w-3.5 -translate-x-0.5 text-muted-foreground transition-all group-hover:translate-x-0' />
                        </div>

                        <div className='h-px w-full bg-border' />
                        {specs.map((spec) => (
                            <div key={spec.label}>
                                <p className='text-[10px] font-medium uppercase text-muted-foreground'>
                                    {spec.label}
                                </p>
                                <p className='text-xs font-semibold text-card-foreground'>
                                    {spec.value}
                                </p>
                            </div>
                        ))}
                        <div className='mt-1'>
                            <p className='text-[10px] font-medium uppercase text-muted-foreground'>
                                Market Value
                            </p>
                            <p className='font-mono text-lg font-bold leading-none tracking-tighter text-card-foreground'>
                                {price}
                            </p>
                        </div>
                        <div>
                            <div className='flex items-center gap-1.5 text-xs font-bold text-emerald-600'>
                                <TrendingUp className='h-3.5 w-3.5' />
                                <span>{trend}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
}
