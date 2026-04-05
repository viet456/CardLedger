import { getCachedCardData } from '@/src/app/cards/[cardId]/data';
import { PriceHistoryChart } from '@/src/components/cards/PriceHistoryChart';
import { AbilityObject } from '@/src/shared-types/card-index';
import { notFound } from 'next/navigation';
import { FilterLink } from '@/src/app/cards/[cardId]/FilterLink';
import { PriceHero } from '@/src/components/cards/PriceHero';
import { EnergyIcon } from '@/src/components/cards/EnergyIcon';
import { FormattedText } from '@/src/components/cards/FormattedText';

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
    }, {} as Record<string, number>)
}

export async function CardDetails({ cardId }: { cardId: string }) {
    const card = await getCachedCardData(cardId);
    if (!card) notFound();

    return (
        <div className='flex flex-col gap-8'>
            <header>
                <h1 className='text-4xl font-bold tracking-tight'>{card.n}</h1>
                <p className='mt-1 text-lg text-muted-foreground'>
                    {card.supertype} - {card.subtypes.join(', ')}
                    {card.hp && ` - HP ${card.hp}`}
                </p>

                {/* Mobile-only PriceHero: visible on small screens, hidden on md+ */}
                <div className='mt-6 block md:hidden'>
                    <PriceHero cardId={cardId} />
                </div>
            </header>

            {/* Price Chart */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Prices</h2>
                <PriceHistoryChart cardId={cardId} />
            </section>

            {/* Details Grid */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Details</h2>
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                    <DetailItem label='Set'>
                        <FilterLink field='setId' value={card.set.id} label={card.set.name} />
                    </DetailItem>
                    <DetailItem label='Card Number'>
                        {card.num} / {card.set.printedTotal}
                    </DetailItem>
                    {card.pokedexNumbers && card.pokedexNumbers.length > 0 && (
                        <DetailItem label='Pokedex Number'>
                            #{card.pokedexNumbers.join(', #')}
                        </DetailItem>
                    )}
                    <DetailItem label='Rarity'>
                        {card.rarity && <FilterLink field='rarity' value={card.rarity} />}
                    </DetailItem>
                    <DetailItem label='Artist'>
                        {card.artist && <FilterLink field='artist' value={card.artist} />}
                    </DetailItem>
                    <DetailItem label='Card Type'>
                        {card.types.map((type, i) => (
                            <span key={type}>
                                <FilterLink field='type' value={type} />
                                {i < card.types.length - 1 && ', '}
                            </span>
                        ))}
                    </DetailItem>

                    {card.weaknesses.length > 0 && (
                        <DetailItem label='Weakness'>
                            {card.weaknesses.map((weakness, i) => (
                                <span key={weakness.type}>
                                    <FilterLink field='weaknessType' value={weakness.type} />
                                    {weakness.value && ` ${weakness.value}`}
                                    {i < card.weaknesses.length - 1 && ', '}
                                </span>
                            ))}
                        </DetailItem>
                    )}

                    {card.resistances.length > 0 && (
                        <DetailItem label='Resistance'>
                            {card.resistances.map((resistance, i) => (
                                <span key={resistance.type}>
                                    <FilterLink field='resistanceType' value={resistance.type} />
                                    {resistance.value && ` ${resistance.value}`}
                                    {i < card.resistances.length - 1 && ', '}
                                </span>
                            ))}
                        </DetailItem>
                    )}

                    {card.cRC !== null && typeof card.cRC !== 'undefined' && (
                        <DetailItem label='Retreat Cost'>{card.cRC}</DetailItem>
                    )}
                    <div className='col-span-2 sm:col-span-3'>
                        <p className='text-sm font-semibold text-muted-foreground'>
                            Format Legalities
                        </p>
                        <div className='mt-1 flex gap-4 text-sm'>
                            <span
                                className={
                                    card.legalities.standard === 'Legal'
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                }
                            >
                                Standard: {card.legalities.standard || 'Not Legal'}
                            </span>
                            <span
                                className={
                                    card.legalities.expanded === 'Legal'
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                }
                            >
                                Expanded: {card.legalities.expanded || 'Not Legal'}
                            </span>
                            <span
                                className={
                                    card.legalities.unlimited === 'Legal'
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                }
                            >
                                Unlimited: {card.legalities.unlimited || 'Not Legal'}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
            {/* Rules Section */}
            {card.rules && card.rules.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Rules</h2>
                    <ul className='list-disc space-y-2 pl-5 text-sm text-muted-foreground'>
                        {card.rules.map((rule, i) => (
                            <li key={i}>{rule}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Ancient Traits Section */}
            {card.ancientTrait && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>
                        Ancient Trait: {card.ancientTrait.name}
                    </h2>
                    <p className='text-sm text-muted-foreground'>{card.ancientTrait.text}</p>
                </section>
            )}

            {/* Attacks Section */}
            {card.attacks.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Attacks</h2>
                    {card.attacks.map((attack) => (
                        <div
                            key={attack.name}
                            className='mb-4 grid grid-cols-4 gap-4 border-b pb-4 last:mb-0 last:border-b-0 last:pb-0'
                        >
                            <div className='col-span-3'>
                                <div className='flex items-center gap-2'>
                                    <p className='font-semibold'>{attack.name}</p>
                                </div>
                                <p className='mt-1 text-sm text-muted-foreground leading-relaxed'>
                                    {attack.text}
                                </p>
                            </div>
                            
                            <div className='col-span-1 flex flex-col items-end gap-1'>
                                <p className='text-lg font-bold tracking-tighter'>
                                    {attack.damage}
                                </p>
                                {/* Energy Icons - Stacked Logic */}
                                <div className='flex flex-wrap justify-end gap-1'>
                                    {Object.entries(getEnergyStack(attack.cost)).map(([type, count]) => (
                                        <div 
                                            key={type} 
                                            className="flex items-center gap-0.5 bg-secondary/50 rounded-full px-1 py-0.5 border border-border/50"
                                        >
                                            {count > 1 && (
                                                <span className="text-xs font-bold pl-0.5">
                                                    {count}×
                                                </span>
                                            )}
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
            {card.abilities.length > 0 && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Abilities</h2>
                    {card.abilities.map((ability: AbilityObject) => (
                        <div key={ability.name} className='mb-4 last:mb-0'>
                            <p className='font-semibold'>
                                {ability.name}{' '}
                                <span className='text-sm text-muted-foreground'>
                                    ({ability.type})
                                </span>
                            </p>
                            <p className='mt-1 text-sm text-muted-foreground'>{ability.text}</p>
                        </div>
                    ))}
                </section>
            )}

            {/* Description Section */}
            {card.description && (
                <section className='rounded-lg border bg-card p-4 shadow-sm'>
                    <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Description</h2>
                    <p className='text-base leading-relaxed text-muted-foreground'>
                        <FormattedText text={card.description} />
                    </p>
                </section>
            )}
        </div>
    );
}
