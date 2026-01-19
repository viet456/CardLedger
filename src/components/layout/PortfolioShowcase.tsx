'use client';
import { TrendingUp, Wallet, Target } from 'lucide-react';
import { PortfolioChart } from '../portfolio/PortfolioChart';
import { PortfolioChartPoint } from '@/src/services/portfolioService';

// --- DETERMINISTIC RANDOM HELPER ---
function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// --- DATA GENERATOR ---
function generateMockHistory(): PortfolioChartPoint[] {
    const data: PortfolioChartPoint[] = [];
    const today = new Date();

    // Starting values
    let currentPrice = 1850;
    let currentCost = 1500;

    for (let i = 365; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Volatility + Growth Trend
        const volatility = (seededRandom(i) - 0.45) * 0.03;
        currentPrice = currentPrice * (1 + volatility);

        // Simulate Purchases (Steps)
        if (i % 45 === 0 && i !== 365) {
            const purchaseAmount = 150 + seededRandom(i + 100) * 200;
            currentCost += purchaseAmount;
            currentPrice += purchaseAmount;
        }

        data.push({
            date: dateStr,
            price: Number(currentPrice.toFixed(2)),
            costBasis: Number(currentCost.toFixed(2))
        });
    }
    return data;
}

const MOCK_PORTFOLIO_DATA = generateMockHistory();

export default function PortfolioShowcase() {
    const currentStats = MOCK_PORTFOLIO_DATA[MOCK_PORTFOLIO_DATA.length - 1];
    const currentValue = currentStats.price;
    const currentCost = currentStats.costBasis;
    const totalGain = currentValue - currentCost;
    const gainPercent = ((totalGain / currentCost) * 100).toFixed(1);

    return (
        <div className='relative flex h-full min-h-[450px] w-full flex-col overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent'>
            {/* Animated background grid */}
            <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20' />

            <div className='relative z-10 flex h-full flex-1 flex-col gap-6 py-6'>
                {/* Header Stats */}
                <div className='grid grid-cols-3 gap-3 px-4 md:px-6'>
                    <div className='rounded-lg border border-border p-3 backdrop-blur-sm'>
                        <div className='mb-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                            <Wallet className='h-3.5 w-3.5' />
                            <span>Portfolio Value</span>
                        </div>
                        <div className='font-mono text-xl font-bold'>
                            ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    <div className='rounded-lg border border-border p-3 backdrop-blur-sm'>
                        <div className='mb-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                            <Target className='h-3.5 w-3.5' />
                            <span>Cost Basis</span>
                        </div>
                        <div className='font-mono text-xl font-bold'>
                            ${currentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    <div className='rounded-lg border border-border p-3 backdrop-blur-sm'>
                        <div className='mb-1 flex items-center gap-1.5 text-xs'>
                            <TrendingUp className='h-3.5 w-3.5' />
                            <span>Total Gain</span>
                        </div>
                        <div className='text-trend-up font-mono text-xl font-bold'>
                            +{gainPercent}%
                        </div>
                    </div>
                </div>

                {/* Chart Container */}
                <div className='flex min-h-0 flex-1 flex-col px-4 md:px-6'>
                    <PortfolioChart initialData={MOCK_PORTFOLIO_DATA} />
                </div>

                {/* Bottom indicator */}
                <div className='mt-auto flex items-center justify-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground'>
                    <div className='h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500' />
                    <span>Live portfolio tracking • Daily price updates</span>
                </div>
            </div>
        </div>
    );
}
