'use client';
import { PortfolioChart } from '@/src/components/portfolio/PortfolioChart';
import { PortfolioChartPoint } from '@/src/services/portfolioService';
import { CardVariant } from '@prisma/client';
import { DataTable } from './DataTable';
import { columns, PortfolioRow } from './Columns';
import { Wallet, TrendingUp, TrendingDown, CircleDollarSign } from 'lucide-react';
import { CardPrices } from '@/src/shared-types/price-api';

interface PortfolioEntry {
    id: string;
    cardId: string;
    purchasePrice: number;
    createdAt: Date | string;
    variant: CardVariant | null; // 'Normal' | 'Holo' | 'Reverse' | 'FirstEdition'
    card: {
        name: string;
        imageKey: string;
        set: {
            name: string;
        };
        variants: CardPrices | null;
    };
}

interface PortfolioViewProps {
    history: PortfolioChartPoint[];
    entries: PortfolioEntry[];
}

interface SummaryCardProps {
    label: string;
    value: number;
    isCurrency?: boolean;
    isProfit?: boolean;
    showSign?: boolean;
    suffix?: string;
    icon?: React.ElementType;
}

function formatVariant(variant: string) {
    // Cleaner display for variants
    if (variant === 'FirstEdition') return '1st Ed';
    if (variant === 'Reverse') return 'Reverse';
    return variant;
}

function SummaryCard({
    label,
    value,
    isCurrency,
    isProfit,
    showSign,
    suffix = '',
    icon: Icon
}: SummaryCardProps) {
    const formatted = isCurrency
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
              Math.abs(value)
          )
        : Math.abs(value).toFixed(2);

    let colorClass = 'text-foreground';
    let iconClass = 'text-muted-foreground';
    let sign = '';

    if (isProfit !== undefined) {
        colorClass = isProfit ? 'text-trend-up' : 'text-trend-down';
        iconClass = isProfit ? 'text-trend-up' : 'text-trend-down';

        if (showSign) {
            sign = isProfit ? '▲ ' : '▼ ';
        }
    }

    return (
        <div
            className='min-w-[240px] rounded-xl border border-border bg-card p-6 shadow-sm'
            tabIndex={0}
            role='region'
            aria-label={`${label}: ${formatted}`}
        >
            <div className={`mb-2 flex items-center gap-2 text-sm font-medium ${iconClass}`}>
                {Icon && <Icon className='h-4 w-4' />}
                <span className='text-muted-foreground'>{label}</span>
            </div>

            <div className={`text-2xl font-bold ${colorClass}`} aria-hidden='true'>
                <span className='mr-1 text-lg'>{sign}</span>
                {formatted}
                {suffix}
            </div>
        </div>
    );
}

export function PortfolioView({ history, entries }: PortfolioViewProps) {
    const currentStats = history[history.length - 1] || { price: 0, costBasis: 0 };
    const totalValue = currentStats.price;
    const totalCost = currentStats.costBasis;
    const totalProfit = totalValue - totalCost;
    const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const TrendIcon = profitPercent >= 0 ? TrendingUp : TrendingDown;

    const tableData: PortfolioRow[] = entries.map((entry) => {
        let currentPrice = 0;
        const variants = entry.card.variants;
        const variantType = entry.variant || CardVariant.Normal;

        if (variants) {
            // Map the variant enum directly to the price key
            // e.g. 'Holo' -> 'tcgHolo'
            const priceKey = `tcg${variantType}` as keyof CardPrices;
            const specificPrice = variants[priceKey];

            // Use specific price, fallback to NearMint, fallback to 0
            currentPrice = specificPrice ?? variants.tcgNearMint ?? 0;
        }

        const cost = entry.purchasePrice;
        const gain = Number(currentPrice) - cost;
        const percent = cost > 0 ? (gain / cost) * 100 : 0;

        return {
            id: entry.id,
            cardId: entry.cardId,
            name: entry.card.name,
            setName: entry.card.set.name,
            image: entry.card.imageKey,
            variant: formatVariant(variantType),
            purchasedAt: new Date(entry.createdAt).toLocaleDateString(),
            purchasePrice: cost,
            currentPrice: Number(currentPrice),
            gain: gain,
            gainPercent: percent
        };
    });

    return (
        <div className='space-y-8'>
            {/* Summary Cards */}
            <div className='flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:pb-0'>
                <SummaryCard label='Total Value' value={totalValue} isCurrency icon={Wallet} />
                <SummaryCard
                    label='Total Profit'
                    value={totalProfit}
                    isCurrency
                    isProfit={totalProfit >= 0}
                    showSign
                    icon={CircleDollarSign}
                />
                <SummaryCard
                    label='All-Time Return'
                    value={profitPercent}
                    suffix='%'
                    isProfit={profitPercent >= 0}
                    showSign
                    icon={TrendIcon}
                />
            </div>

            {/* The Chart */}
            <div className='rounded-xl border border-border bg-card p-4 shadow-sm'>
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
