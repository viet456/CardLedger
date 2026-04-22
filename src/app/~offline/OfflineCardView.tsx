'use client';

import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore'; 
import { CardImageDisplay } from '../cards/[cardId]/CardImageDisplay';
import { AlertTriangle, WifiOff, TrendingUp, ChevronRight } from 'lucide-react';
import { FormattedText } from '@/src/components/cards/FormattedText';
import { EnergyIcon } from '@/src/components/cards/EnergyIcon';
import Link from 'next/link';
import { FilterLink } from '@/src/app/cards/[cardId]/FilterLink';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { BreadcrumbSkeleton, ImageSkeleton, PriceHeroSkeleton, DetailsSkeleton } from '../cards/[cardId]/Skeletons';

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <p className='text-sm font-semibold text-muted-foreground'>{label}</p>
        <p className='text-base'>{children}</p>
    </div>
);

const getEnergyStack = (costs: string[]) => {
    return costs.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}

export function OfflineCardView({ cardId }: { cardId: string }) {
    const hasHydrated = useHasHydrated()
    const { 
        cardMap, sets, supertypes, subtypes, rarities, names, 
        types, artists, attacks, abilities, rules
    } = useCardStore();
    
    // Pull the market index from memory!
    const { prices, version } = useMarketStore(); 
    
    const card = cardMap.get(cardId);

    if (!hasHydrated) {
        return (
            <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
                <BreadcrumbSkeleton />
                <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                    <div className='md:col-span-1'>
                        <ImageSkeleton />
                        <div className='hidden md:block px-2 mt-4'>
                            <PriceHeroSkeleton />
                        </div>
                    </div>
                    <DetailsSkeleton />
                </div>
            </main>
        );
    }

    const cardMarketData = prices[cardId]; // Your local pricing object

    // Replicate /components/cards/PriceHero.tsx priority logic for the offline snapshot
    const offlinePrice:number = cardMarketData 
        ? (cardMarketData.tcgNearMint || cardMarketData.tcgNormal || cardMarketData.tcgHolo || cardMarketData.tcgReverse || cardMarketData.tcgFirstEdition || 0)
        : 0;
    
    // Parse "20260420T113836808Z" -> "Apr 20, 2026"
    const syncDate = version && version.length > 8 
        ? new Date(`${version.substring(0,4)}-${version.substring(4,6)}-${version.substring(6,8)}`)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown Date';
    if (!card) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-12 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold">Card Not Found Locally</h2>
                <p className="text-muted-foreground">This card isn&apos;t in your local index. Please connect to the internet to fetch it.</p>
            </div>
        );
    }

    // --- Denormalize Data ---
    const setId = card.s !== null ? sets[card.s].id : '';
    const setName = card.s !== null ? sets[card.s].name : 'Unknown Set';
    const supertypeName = card.st !== null ? supertypes[card.st] : '';
    const subtypeNames = card.sb.map(idx => subtypes[idx]);
    const rarityName = card.r !== null ? rarities[card.r] : 'Unknown Rarity';
    const artistName = card.a !== null ? artists[card.a] : null;
    const typeNames = card.t.map(idx => types[idx]);
    const mappedWeaknesses = (card.w || []).map(w => ({ type: types[w.t], value: w.v }));
    const mappedResistances = (card.rs || []).map(r => ({ type: types[r.t], value: r.v }));
    const mappedAttacks = card.ak.map(idx => attacks[idx]);
    const mappedAbilities = card.ab.map(idx => abilities[idx]);
    const mappedRules = card.ru.map(idx => rules[idx]);

    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            
            {/* Breadcrumbs Links */}
            <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
                <Link href='/sets' className='hover:underline'>
                    Sets
                </Link>
                <ChevronRight className='h-4 w-4' />
                <Link
                    href={`/sets/${setId}?sortBy=num&sortOrder=asc`}
                    className='hover:underline'
                >
                    {setName}
                </Link>
            </nav>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN --- */}
                <div className='md:col-span-1'>
                    <div className='md:sticky md:top-20 flex flex-col gap-4'>
                        <CardImageDisplay img={`cards/${cardId}`} name={names[card.n]} id={cardId} />
                        
                        {/* Desktop PriceHero Parity */}
                        <div className='hidden md:block px-2'> 
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Current Market Price
                                </span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold tracking-tight">
                                        {/* If we have data, show it. Otherwise, show a clean N/A */}
                                        {cardMarketData ? `$${offlinePrice.toFixed(2)}` : 'N/A'}
                                    </span>
                                    <div className="flex items-center text-sm font-bold text-muted-foreground opacity-50">
                                        <span>(Offline)</span>
                                    </div>
                                </div>
                                {/* The Last Synced Indicator */}
                                <span className="text-[10px] font-medium text-muted-foreground opacity-70">
                                    Last synced: {syncDate}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className='md:col-span-2'>
                    <div className='flex flex-col gap-8'>
                        <header>
                            <div className="flex items-start justify-between">
                                <h1 className='text-4xl font-bold tracking-tight'>{names[card.n]}</h1>
                                {card.hp && (
                                    <span className="text-2xl font-bold tracking-tighter opacity-80">
                                        {card.hp} HP
                                    </span>
                                )}
                            </div>
                            <p className='mt-1 text-lg text-muted-foreground'>
                                {supertypeName} {subtypeNames.length > 0 && `— ${subtypeNames.join(', ')}`}
                            </p>
                        </header>

                        {/* Price Chart Area Parity */}
                        <section className='rounded-lg border bg-card p-4 shadow-sm'>
                            <div className="flex items-center justify-between mb-2">
                                <h2 className='text-2xl font-semibold tracking-tight'>Prices</h2>
                                <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Offline Snapshot</span>
                                </div>
                            </div>
                            <div className="flex h-[300px] flex-col items-center justify-center rounded-md bg-muted/30 p-6 text-center">
                                <TrendingUp className="h-10 w-10 text-muted-foreground/50 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    Historical charts require a network connection.
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Current prices are pulled from your local cache, last updated on <span className="font-semibold">{syncDate}</span>.
                                </p>
                            </div>
                        </section>

                        {/* Details Grid */}
                        <section className='rounded-lg border bg-card p-4 shadow-sm'>
                            <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Details</h2>
                            <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                                
                                <DetailItem label='Set'>
                                    <FilterLink field='setId' value={setId} label={setName} />
                                </DetailItem>
                                
                                <DetailItem label='Card Number'>{card.num} / {sets[card.s].printedTotal}</DetailItem>
                                
                                {card.pdx && card.pdx.length > 0 && (
                                    <DetailItem label='Pokedex Number'>#{card.pdx.join(', #')}</DetailItem>
                                )}
                                
                                {rarityName && (
                                    <DetailItem label='Rarity'>
                                        <FilterLink field='rarity' value={rarityName} />
                                    </DetailItem>
                                )}
                                
                                {artistName && (
                                    <DetailItem label='Artist'>
                                        <FilterLink field='artist' value={artistName} />
                                    </DetailItem>
                                )}
                                
                                <DetailItem label='Card Type'>
                                    {typeNames.map((type, i) => (
                                        <span key={type}>
                                            <FilterLink field='type' value={type} />
                                            {i < typeNames.length - 1 && ', '}
                                        </span>
                                    ))}
                                </DetailItem>

                                {mappedWeaknesses.length > 0 && (
                                    <DetailItem label='Weakness'>
                                        {mappedWeaknesses.map((w, i) => (
                                            <span key={w.type}>
                                                <FilterLink field='weaknessType' value={w.type} />
                                                {w.value && ` ${w.value}`}
                                                {i < mappedWeaknesses.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </DetailItem>
                                )}

                                {mappedResistances.length > 0 && (
                                    <DetailItem label='Resistance'>
                                        {mappedResistances.map((r, i) => (
                                            <span key={r.type}>
                                                <FilterLink field='resistanceType' value={r.type} />
                                                {r.value && ` ${r.value}`}
                                                {i < mappedResistances.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </DetailItem>
                                )}

                                {card.cRC !== null && (
                                    <DetailItem label='Retreat Cost'>{card.cRC}</DetailItem>
                                )}

                                <div className='col-span-2 sm:col-span-3'>
                                    <p className='text-sm font-semibold text-muted-foreground'>Format Legalities</p>
                                    <div className='mt-1 flex gap-4 text-sm'>
                                        <span className={card.leg.s === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                            Standard: {card.leg.s || 'Not Legal'}
                                        </span>
                                        <span className={card.leg.e === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                            Expanded: {card.leg.e || 'Not Legal'}
                                        </span>
                                        <span className={card.leg.u === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                            Unlimited: {card.leg.u || 'Not Legal'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Rules Section */}
                        {mappedRules.length > 0 && (
                            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                                <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Rules</h2>
                                <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
                                    {mappedRules.map((rule, i) => (
                                        <li key={i}>{rule}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Ancient Traits Section */}
                        {card.aT && (
                            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                                <h2 className='mb-2 text-2xl font-semibold tracking-tight'>
                                    Ancient Trait: {card.aT.n}
                                </h2>
                                <p className='text-sm text-muted-foreground'>{card.aT.t}</p>
                            </section>
                        )}

                        {/* Attacks Section */}
                        {mappedAttacks.length > 0 && (
                            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                                <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Attacks</h2>
                                {mappedAttacks.map((attack) => (
                                    <div key={attack.name} className='mb-4 grid grid-cols-4 gap-4 border-b pb-4 last:mb-0 last:border-b-0 last:pb-0'>
                                        <div className='col-span-3'>
                                            <p className='font-semibold'>{attack.name}</p>
                                            <p className='mt-1 text-sm text-muted-foreground leading-relaxed'>
                                                {attack.text && <FormattedText text={attack.text} />}
                                            </p>
                                        </div>
                                        <div className='col-span-1 flex flex-col items-end gap-1'>
                                            <p className='text-lg font-bold tracking-tighter'>{attack.damage}</p>
                                            <div className='flex flex-wrap justify-end gap-1'>
                                                {Object.entries(getEnergyStack(attack.cost)).map(([type, count]) => (
                                                    <div key={type} className="flex items-center gap-0.5 bg-secondary/50 rounded-full px-1 py-0.5 border border-border/50">
                                                        {count > 1 && <span className="text-xs font-bold pl-0.5">{count}×</span>}
                                                        <EnergyIcon type={type} size={18} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Abilities Section */}
                        {mappedAbilities.length > 0 && (
                            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                                <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Abilities</h2>
                                {mappedAbilities.map((ability) => (
                                    <div key={ability.name} className='mb-4 last:mb-0'>
                                        <p className='font-semibold'>
                                            {ability.name} <span className='text-sm text-muted-foreground'>({ability.type})</span>
                                        </p>
                                        <div className='mt-1 text-sm text-muted-foreground'>
                                            <FormattedText text={ability.text} />
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {/* Game Stats Section */}
                        {(mappedWeaknesses.length > 0 || mappedResistances.length > 0 || (card.cRC !== null && card.cRC > 0)) && (
                            <section className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4 shadow-sm text-center">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weakness</p>
                                    <div className="mt-1 flex justify-center gap-1">
                                        {mappedWeaknesses.length > 0 ? mappedWeaknesses.map(w => (
                                            <div key={w.type} className="flex items-center gap-1">
                                                <EnergyIcon type={w.type} size={16} />
                                                <span className="text-sm font-bold">{w.value}</span>
                                            </div>
                                        )) : <span className="text-sm opacity-30">—</span>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resistance</p>
                                    <div className="mt-1 flex justify-center gap-1">
                                        {mappedResistances.length > 0 ? mappedResistances.map(r => (
                                            <div key={r.type} className="flex items-center gap-1">
                                                <EnergyIcon type={r.type} size={16} />
                                                <span className="text-sm font-bold">{r.value}</span>
                                            </div>
                                        )) : <span className="text-sm opacity-30">—</span>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retreat</p>
                                    <div className="mt-1 flex justify-center gap-1">
                                        {card.cRC !== null && card.cRC > 0 ? (
                                            <div className="flex gap-0.5">
                                                {Array.from({ length: card.cRC }).map((_, i) => (
                                                    <EnergyIcon key={i} type="Colorless" size={16} />
                                                ))}
                                            </div>
                                        ) : <span className="text-sm opacity-30">—</span>}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Description Section */}
                        {card.d && (
                            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                                <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Description</h2>
                                <p className='text-base leading-relaxed text-muted-foreground'>
                                    <FormattedText text={card.d} />
                                </p>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}