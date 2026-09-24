import { getCachedCardData, getCachedPriceHistory } from './data';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';

const HEADLINE_VARIANTS: {
    key: keyof Omit<PriceHistoryDataPoint, 'timestamp'>;
    label: string;
}[] = [
    { key: 'tcgNearMint', label: 'Near Mint' },
    { key: 'tcgNormal', label: 'Normal' },
    { key: 'tcgHolo', label: 'Holo' },
    { key: 'tcgReverse', label: 'Reverse Holo' },
    { key: 'tcgFirstEdition', label: '1st Edition' }
];

function formatUsd(value: number): string {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toUtcDate(value: string | Date): Date {
    // getCachedPriceHistory returns 'YYYY-MM-DD' strings
    return typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;
}

function formatDate(value: string | Date): string {
    return toUtcDate(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

/**
 * Server-rendered price prose for card pages. The client chart is invisible to
 * crawlers — this text carries the actual numbers in the HTML.
 */
export async function PriceSummary({ cardId }: { cardId: string }) {
    const [card, history] = await Promise.all([
        getCachedCardData(cardId),
        getCachedPriceHistory(cardId)
    ]);
    if (!card || history.length === 0) return null;

    const latest = history[history.length - 1];

    // Headline = first available variant, Near Mint first
    const headline = HEADLINE_VARIANTS.find((v) => typeof latest[v.key] === 'number');
    if (!headline) return null;
    const headlinePrice = latest[headline.key] as number;

    // 30-day change on the headline variant (approximate by data availability)
    const cutoff = toUtcDate(latest.timestamp);
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const priorPoint = [...history].reverse().find((p) => toUtcDate(p.timestamp) <= cutoff);
    const priorPrice = priorPoint ? (priorPoint[headline.key] as number | null) : null;

    const otherVariants = HEADLINE_VARIANTS.filter(
        (v) => v.key !== headline.key && typeof latest[v.key] === 'number'
    );

    const fullName = `${card.n} #${card.num} (${card.set.name})`;

    return (
        <p className='text-sm leading-relaxed text-muted-foreground'>
            As of {formatDate(latest.timestamp)}, the market price of {fullName} is{' '}
            <span className='font-semibold text-foreground'>
                {formatUsd(headlinePrice)} ({headline.label})
            </span>
            , based on recent Pokémon TCG market sales.
            {priorPrice !== null &&
                priorPrice > 0 &&
                ` That is ${
                    headlinePrice >= priorPrice ? 'up' : 'down'
                } ${Math.abs(((headlinePrice - priorPrice) / priorPrice) * 100).toFixed(1)}% (${formatUsd(
                    Math.abs(headlinePrice - priorPrice)
                )}) compared with 30 days earlier.`}
            {otherVariants.length > 0 && (
                <>
                    {' '}
                    Other printings and conditions: {otherVariants.map((v, i) => (
                        <span key={v.key}>
                            {i > 0 && ', '}
                            {v.label} {formatUsd(latest[v.key] as number)}
                        </span>
                    ))}
                    .
                </>
            )}{' '}
            Prices update daily; check the chart above for the full history.
        </p>
    );
}
