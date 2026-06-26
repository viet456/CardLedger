'use client';

import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore'; 
import { PriceHistoryChart } from '@/src/components/cards/PriceHistoryChart';
import { AlertTriangle } from 'lucide-react';
import { FormattedText } from '@/src/components/cards/FormattedText';
import { EnergyIcon } from '@/src/components/cards/EnergyIcon';
import { FilterLink } from '@/src/app/cards/[cardId]/FilterLink';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { DetailsSkeleton } from './Skeletons';
import { denormalizeSingleCard } from '@/src/utils/cardUtils';

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

export function ClientCachedDetailsFallback({ cardId }: { cardId: string }) {
    const hasHydrated = useHasHydrated();
    const store = useCardStore();
    const { version } = useMarketStore(); 
    
    const card = store.cardMap.get(cardId);

    if (!hasHydrated || !card) {
        return <DetailsSkeleton />;
    }

    // Parse "20260420T113836808Z" -> "Apr 20, 2026"
    const syncDate = version && version.length > 8 
        ? new Date(`${version.substring(0,4)}-${version.substring(4,6)}-${version.substring(6,8)}`)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown Date';

    // --- Denormalize Data ---
    const denormalized = denormalizeSingleCard(card, store);

    return (
        <div className='flex flex-col gap-8 md:col-span-2'>
            <header>
                <div className="flex items-start justify-between">
                    <h1 className='text-4xl font-bold tracking-tight'>{denormalized.n}</h1>
                    {denormalized.hp && (
                        <span className="text-2xl font-bold tracking-tighter opacity-80">
                            {denormalized.hp} HP
                        </span>
                    )}
                </div>
                <p className='mt-1 text-lg text-muted-foreground'>
                    {denormalized.supertype} {denormalized.subtypes.length > 0 && `— ${denormalized.subtypes.join(', ')}`}
                </p>
            </header>

            {/* Price Chart Area Parity */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <div className="flex items-center justify-between mb-2">
                    <h2 className='text-2xl font-semibold tracking-tight'>Prices</h2>
                </div>
                <PriceHistoryChart cardId={cardId} />
            </section>

            {/* Details Grid */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Details</h2>
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                    
                    {denormalized.set && (
                        <DetailItem label='Set'>
                            <FilterLink field='setId' value={denormalized.set.id} label={denormalized.set.name} />
                        </DetailItem>
                    )}
                    
                    {denormalized.set && (
                        <DetailItem label='Card Number'>{denormalized.num} / {denormalized.set.printedTotal}</DetailItem>
                    )}
                    
                    {denormalized.pokedexNumbers && denormalized.pokedexNumbers.length > 0 && (
                        <DetailItem label='Pokedex Number'>#{denormalized.pokedexNumbers.join(', #')}</DetailItem>
                    )}
                    
                    {denormalized.rarity && (
                        <DetailItem label='Rarity'>
                            <FilterLink field='rarity' value={denormalized.rarity} />
                        </DetailItem>
                    )}
                    
                    {denormalized.artist && (
                        <DetailItem label='Artist'>
                            <FilterLink field='artist' value={denormalized.artist} />
                        </DetailItem>
                    )}
                    
                    {denormalized.types.length > 0 && (
                        <DetailItem label='Card Type'>
                            {denormalized.types.map((type, i) => (
                                <span key={type}>
                                    <FilterLink field='type' value={type} />
                                    {i < denormalized.types.length - 1 && ', '}
                                </span>
                            ))}
                        </DetailItem>
                    )}

                    {denormalized.weaknesses.length > 0 && (
                        <DetailItem label='Weakness'>
                            {denormalized.weaknesses.map((w, i) => (
                                <span key={w.type}>
                                    <FilterLink field='weaknessType' value={w.type} />
                                    {w.value && ` ${w.value}`}
                                    {i < denormalized.weaknesses.length - 1 && ', '}
                                </span>
                            ))}
                        </DetailItem>
                    )}

                    {denormalized.resistances.length > 0 && (
                        <DetailItem label='Resistance'>
                            {denormalized.resistances.map((r, i) => (
                                <span key={r.type}>
                                    <FilterLink field='resistanceType' value={r.type} />
                                    {r.value && ` ${r.value}`}
                                    {i < denormalized.resistances.length - 1 && ', '}
                                </span>
                            ))}
                        </DetailItem>
                    )}

                    {denormalized.cRC !== null && (
                        <DetailItem label='Retreat Cost'>{denormalized.cRC}</DetailItem>
                    )}

                    <div className='col-span-2 sm:col-span-3'>
                        <p className='text-sm font-semibold text-muted-foreground'>Format Legalities</p>
                        <div className='mt-1 flex gap-4 text-sm'>
                            <span className={denormalized.legalities.standard === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                Standard: {denormalized.legalities.standard || 'Not Legal'}
                            </span>
                            <span className={denormalized.legalities.expanded === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                Expanded: {denormalized.legalities.expanded || 'Not Legal'}
                            </span>
                            <span className={denormalized.legalities.unlimited === 'Legal' ? 'text-green-400' : 'text-red-400'}>
                                Unlimited: {denormalized.legalities.unlimited || 'Not Legal'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Rules Section */}
            {denormalized.rules.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Rules</h2>
                    <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
                        {denormalized.rules.map((rule, i) => (
                            <li key={i}>{rule}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Ancient Traits Section */}
            {denormalized.ancientTrait && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>
                        Ancient Trait: {denormalized.ancientTrait.name}
                    </h2>
                    <p className='text-sm text-muted-foreground'>{denormalized.ancientTrait.text}</p>
                </section>
            )}

            {/* Attacks Section */}
            {denormalized.attacks.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Attacks</h2>
                    {denormalized.attacks.map((attack) => (
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
            {denormalized.abilities.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Abilities</h2>
                    {denormalized.abilities.map((ability) => (
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
            {(denormalized.weaknesses.length > 0 || denormalized.resistances.length > 0 || (denormalized.cRC !== null && denormalized.cRC > 0)) && (
                <section className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4 shadow-sm text-center">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weakness</p>
                        <div className="mt-1 flex justify-center gap-1">
                            {denormalized.weaknesses.length > 0 ? denormalized.weaknesses.map(w => (
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
                            {denormalized.resistances.length > 0 ? denormalized.resistances.map(r => (
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
                            {denormalized.cRC !== null && denormalized.cRC > 0 ? (
                                <div className="flex gap-0.5">
                                    {Array.from({ length: denormalized.cRC }).map((_, i) => (
                                        <EnergyIcon key={i} type="Colorless" size={16} />
                                    ))}
                                </div>
                            ) : <span className="text-sm opacity-30">—</span>}
                        </div>
                    </div>
                </section>
            )}

            {/* Description Section */}
            {denormalized.description && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Description</h2>
                    <p className='text-base leading-relaxed text-muted-foreground'>
                        <FormattedText text={denormalized.description} />
                    </p>
                </section>
            )}
        </div>
    );
}
