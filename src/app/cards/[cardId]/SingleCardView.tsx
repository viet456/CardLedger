'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { DenormalizedCard, AbilityObject } from '@/src/shared-types/card-index';
import { ChevronRight } from 'lucide-react';

// Helper component for creating consistent filter links
const FilterLink = ({ field, value }: { field: string; value: string }) => (
    <Link
        href={`/cards?${field}=${encodeURIComponent(value)}`}
        className='text-primary hover:underline'
    >
        {value}
    </Link>
);

// A reusable component for displaying a key-value pair in the details grid
const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <p className='text-sm font-semibold text-muted-foreground'>{label}</p>
        <p className='text-base'>{children}</p>
    </div>
);

export function SingleCardView({
    card,
    children
}: {
    card: DenormalizedCard;
    children: React.ReactNode;
}) {
    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            {/* Breadcrumb Navigation */}
            <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
                <Link href='/sets' className='hover:underline'>
                    Sets
                </Link>
                <ChevronRight className='h-4 w-4' />
                <Link
                    href={`/sets/${card.set.id}?sortBy=num&sortOrder=asc`}
                    className='hover:underline'
                >
                    {card.set.name}
                </Link>
            </nav>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN: CARD IMAGE --- */}
                <div className='md:col-span-1'>
                    {card.img ? (
                        <CldImage
                            src={card.img}
                            alt={card.n}
                            width={500}
                            height={700}
                            sizes='(max-width: 768px) 100vw, 33vw'
                            className='w-full rounded-xl shadow-lg'
                            quality='auto'
                            format='auto'
                            priority
                        />
                    ) : (
                        <div className='flex aspect-[2.5/3.5] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground'>
                            No Image
                        </div>
                    )}
                </div>

                {/* --- RIGHT COLUMN: CARD DATA --- */}
                <div className='flex flex-col gap-8 md:col-span-2'>
                    {/* Header */}
                    <header>
                        <h1 className='text-4xl font-bold tracking-tight'>{card.n}</h1>
                        <p className='mt-1 text-lg text-muted-foreground'>
                            {card.supertype} - {card.subtypes.join(', ')}
                            {card.hp && ` - HP ${card.hp}`}
                        </p>
                    </header>

                    {/* Prices Section (Placeholder for V2) */}
                    <section className='rounded-lg border bg-card p-4 shadow-sm'>
                        <h2 className='mb-2 text-2xl font-semibold tracking-tight'>Prices</h2>
                        {children}
                    </section>

                    {/* Details Section */}
                    <section className='rounded-lg border bg-card p-4 shadow-sm'>
                        <h2 className='mb-4 text-2xl font-semibold tracking-tight'>Details</h2>
                        <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                            <DetailItem label='Set'>
                                <FilterLink field='setId' value={card.set.name} />
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
                                            <FilterLink
                                                field='weaknessType'
                                                value={weakness.type}
                                            />
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
                                            <FilterLink
                                                field='resistanceType'
                                                value={resistance.type}
                                            />
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
                            <p className='text-sm text-muted-foreground'>
                                {card.ancientTrait.text}
                            </p>
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
                                        <p className='font-semibold'>{attack.name}</p>
                                        <p className='mt-1 text-sm text-muted-foreground'>
                                            {attack.text}
                                        </p>
                                    </div>
                                    <div className='col-span-1 text-right'>
                                        <p className='text-lg font-bold'>{attack.damage}</p>
                                        <p className='text-sm text-muted-foreground'>
                                            {attack.cost.join(', ')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Abilities Section */}
                    {card.abilities.length > 0 && (
                        <section className='rounded-lg border bg-card p-4 shadow-sm'>
                            <h2 className='mb-4 text-2xl font-semibold tracking-tight'>
                                Abilities
                            </h2>
                            {card.abilities.map((ability: AbilityObject) => (
                                <div key={ability.name} className='mb-4 last:mb-0'>
                                    <p className='font-semibold'>
                                        {ability.name}{' '}
                                        <span className='text-sm text-muted-foreground'>
                                            ({ability.type})
                                        </span>
                                    </p>
                                    <p className='mt-1 text-sm text-muted-foreground'>
                                        {ability.text}
                                    </p>
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            </div>
        </main>
    );
}
