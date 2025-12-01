'use client';
import { PortfolioChart } from '@/src/components/portfolio/PortfolioChart';
import { PortfolioChartPoint } from '@/src/services/portfolioService';
import { CardCondition } from '@prisma/client';
import { DataTable } from './DataTable';
import { columns, PortfolioRow } from './Columns';

interface PortfolioViewProps {
    history: PortfolioChartPoint[];
    entries: any[];
}

interface SummaryCardProps {
    label: string;
    value: number;
    isCurrency?: boolean;
    isProfit?: boolean;
    showSign?: boolean;
    suffix?: string;
}

function formatCondition(cond: string) {
    return cond.replace('tcg', '').replace(/([A-Z])[a-z]+/g, '$1');
}

function SummaryCard({
    label,
    value,
    isCurrency,
    isProfit,
    showSign,
    suffix = ''
}: SummaryCardProps) {
    const formatted = isCurrency
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              Math.abs(value)
          )
        : value.toFixed(2);

    const colorClass =
        isProfit === undefined ? 'text-foreground' : isProfit ? 'text-emerald-500' : 'text-red-500';

    return (
        <div className='rounded-xl border bg-card p-6 shadow-sm'>
            <div className='text-sm font-medium text-muted-foreground'>{label}</div>
            <div className={`text-2xl font-bold ${colorClass}`}>
                {showSign && isProfit !== undefined ? (isProfit ? '+' : '-') : ''}
                {formatted}
                {suffix}
            </div>
        </div>
    );
}

export function PortfolioView({ history, entries }: PortfolioViewProps) {
    // Calculate Summary Stats
    const currentStats = history[history.length - 1] || { price: 0, costBasis: 0 };
    const totalValue = currentStats.price;
    const totalCost = currentStats.costBasis;
    const totalProfit = totalValue - totalCost;
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const tableData: PortfolioRow[] = entries.map((entry) => {
        let currentPrice = 0;
        const stats = entry.card.marketStats;
        if (stats) {
            switch (entry.condition) {
                case CardCondition.tcgNearMint:
                    currentPrice = stats.tcgNearMintLatest ?? 0;
                    break;
                case CardCondition.tcgLightlyPlayed:
                    currentPrice = stats.tcgLightlyPlayedLatest ?? 0;
                    break;
                case CardCondition.tcgModeratelyPlayed:
                    currentPrice = stats.tcgModeratelyPlayedLatest ?? 0;
                    break;
                case CardCondition.tcgHeavilyPlayed:
                    currentPrice = stats.tcgHeavilyPlayedLatest ?? 0;
                    break;
                case CardCondition.tcgDamaged:
                    currentPrice = stats.tcgDamagedLatest ?? 0;
                    break;
                default:
                    currentPrice = stats.tcgNearMintLatest ?? 0;
            }
        }

        const cost = Number(entry.purchasePrice);
        const gain = Number(currentPrice) - cost;
        const percent = cost > 0 ? (gain / cost) * 100 : 0;

        return {
            id: entry.id,
            cardId: entry.cardId,
            name: entry.card.name,
            setName: entry.card.set.name,
            image: entry.card.imageKey,
            condition: formatCondition(entry.condition),
            purchasedAt: entry.createdAt.toString(),
            purchasePrice: cost,
            currentPrice: Number(currentPrice),
            gain: gain,
            gainPercent: percent
        };
    });

    return (
        <div className='space-y-8'>
            {/* Summary Cards */}
            <div className='grid gap-4 md:grid-cols-3'>
                <SummaryCard label='Total Value' value={totalValue} isCurrency />
                <SummaryCard
                    label='Total Profit'
                    value={totalProfit}
                    isCurrency
                    isProfit={totalProfit >= 0}
                    showSign
                />
                <SummaryCard
                    label='All-Time Return'
                    value={profitPercent}
                    suffix='%'
                    isProfit={profitPercent >= 0}
                    showSign
                />
            </div>

            {/* The Chart */}
            <div className='rounded-xl border bg-card p-6 shadow-sm'>
                <h3 className='mb-6 text-lg font-semibold'>Performance History</h3>
                {history.length > 0 ? (
                    <PortfolioChart initialData={history} />
                ) : (
                    <div className='flex h-64 items-center justify-center text-muted-foreground'>
                        Not enough data history to display chart.
                    </div>
                )}
            </div>

            {/* The Holdings Table */}
            <div className='space-y-4'>
                <h3 className='text-lg font-semibold'>Holdings</h3>
                <DataTable columns={columns} data={tableData} />
            </div>
        </div>
    );
}
