import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getCachedRelatedCards, RelatedCardLink } from './data';
import { RelatedCardTile } from './RelatedCardTile';

function captionFor(link: RelatedCardLink): string {
    return `${link.setName} · ${link.number}`;
}

function TextLink({ link }: { link: RelatedCardLink }) {
    return (
        <Link
            href={`/cards/${link.id}`}
            className='text-primary text-sm font-medium hover:underline'
        >
            {link.name} <span className='text-muted-foreground font-normal'>#{link.number}</span>
        </Link>
    );
}

/**
 * Server-rendered internal linking block for card pages: evolution relatives,
 * prev/next within the set (locked 'num' order), other printings of the same
 * species, and a name search fallback. Every card page gets real outbound
 * links instead of being a crawl dead-end.
 */
export async function RelatedCards({ cardId }: { cardId: string }) {
    const related = await getCachedRelatedCards(cardId);
    if (!related) return null;

    const hasEvolutions = !!related.evolvesFrom || related.evolvesTo.length > 0;
    const hasNeighbors = !!related.prevInSet || !!related.nextInSet;

    return (
        <section
            aria-label='Related cards'
            className='rounded-lg border bg-card p-4 shadow-sm'
        >
            <h2 className='mb-3 text-2xl font-semibold tracking-tight'>Related Cards</h2>

            <div className='flex flex-col gap-6'>
                {hasEvolutions && (
                    <div className='flex flex-col gap-2'>
                        {related.evolvesFrom && (
                            <div className='flex items-center gap-2'>
                                <span className='w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                                    Evolves from
                                </span>
                                <TextLink link={related.evolvesFrom} />
                            </div>
                        )}
                        {related.evolvesTo.length > 0 && (
                            <div className='flex items-center gap-2'>
                                <span className='w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                                    Evolves into
                                </span>
                                <span className='flex flex-wrap gap-x-3 gap-y-1'>
                                    {related.evolvesTo.map((link) => (
                                        <TextLink key={link.id} link={link} />
                                    ))}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {hasNeighbors && (
                    <nav aria-label='Cards in this set' className='flex items-center justify-between gap-4'>
                        {related.prevInSet ? (
                            <Link
                                href={`/cards/${related.prevInSet.id}`}
                                className='flex min-w-0 items-center gap-1 text-sm text-primary hover:underline'
                            >
                                <ChevronLeft className='h-4 w-4 shrink-0' />
                                <span className='truncate'>
                                    #{related.prevInSet.number} {related.prevInSet.name}
                                </span>
                            </Link>
                        ) : (
                            <span />
                        )}
                        {related.nextInSet ? (
                            <Link
                                href={`/cards/${related.nextInSet.id}`}
                                className='flex min-w-0 items-center gap-1 text-right text-sm text-primary hover:underline'
                            >
                                <span className='truncate'>
                                    #{related.nextInSet.number} {related.nextInSet.name}
                                </span>
                                <ChevronRight className='h-4 w-4 shrink-0' />
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}

                {related.sameSpecies.length > 0 && (
                    <div className='flex flex-col gap-2'>
                        <h3 className='text-sm font-semibold uppercase tracking-wider text-muted-foreground'>
                            More {related.cardName} cards
                        </h3>
                        <div className='grid grid-cols-3 gap-2 sm:grid-cols-6'>
                            {related.sameSpecies.map((link) => (
                                <RelatedCardTile
                                    key={link.id}
                                    href={`/cards/${link.id}`}
                                    imageKey={link.imageKey}
                                    name={link.name}
                                    caption={captionFor(link)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <Link
                    href={`/cards?search=${encodeURIComponent(related.cardName)}`}
                    className='inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline'
                >
                    <Search className='h-4 w-4' />
                    Browse all {related.cardName} cards
                </Link>
            </div>
        </section>
    );
}