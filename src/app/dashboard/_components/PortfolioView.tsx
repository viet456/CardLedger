'use client';
import { PortfolioChart } from '@/src/components/ledger/PortfolioChart';
import { PortfolioChartPoint } from '@/src/services/portfolioService';

interface PortfolioViewProps {
    history: PortfolioChartPoint[];
}

interface SummaryCardProps {
    label: string;
    value: number;
    isCurrency?: boolean;
    isProfit?: boolean;
    showSign?: boolean;
    suffix?: string;
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

export function PortfolioView({ history }: PortfolioViewProps) {
    // Calculate Summary Stats
    const currentStats = history[history.length - 1] || { price: 0, costBasis: 0 };
    const totalValue = currentStats.price;
    const totalCost = currentStats.costBasis;
    const totalProfit = totalValue - totalCost;
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

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

            {/* C. The Holdings Table */}
        </div>
    );
}
