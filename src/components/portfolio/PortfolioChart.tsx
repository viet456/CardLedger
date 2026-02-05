'use client';
import { Chart, type ChartOptions } from 'chart.js/auto';
import { useEffect, useRef, useState, useMemo } from 'react';
import 'chartjs-adapter-date-fns';
import { Button } from '@/src/components/ui/button';
import { useTheme } from 'next-themes';
import { PortfolioChartPoint } from '@/src/services/portfolioService';

interface PortfolioChartProps {
    initialData: PortfolioChartPoint[];
}

type TimeRange = '1m' | '3m' | '6m' | '1y' | 'YTD' | 'All';

export function PortfolioChart({ initialData }: PortfolioChartProps) {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const { resolvedTheme } = useTheme();

    const earliestDate = useMemo(() => {
        if (initialData.length === 0) return new Date();
        return new Date(initialData[0].date);
    }, [initialData]);

    // Default to '3m' or 'All' based on data length
    const [activeRange, setActiveRange] = useState<TimeRange>(() => {
        if (!initialData || initialData.length === 0) return 'All';
        const now = new Date().getTime();
        const start = earliestDate.getTime();
        const diffDays = (now - start) / (1000 * 60 * 60 * 24);
        if (diffDays >= 90) return '3m';
        if (diffDays >= 30) return '1m';
        return 'All';
    });

    const cutoffs = useMemo(() => {
        const now = new Date();
        return {
            '1m': new Date(new Date().setMonth(now.getMonth() - 1)),
            '3m': new Date(new Date().setMonth(now.getMonth() - 3)),
            '6m': new Date(new Date().setMonth(now.getMonth() - 6)),
            '1y': new Date(new Date().setFullYear(now.getFullYear() - 1)),
            YTD: new Date(now.getFullYear(), 0, 1)
        };
    }, []);

    const filteredData = useMemo(() => {
        let startDate = new Date();
        switch (activeRange) {
            case '1m':
                startDate = cutoffs['1m'];
                break;
            case '3m':
                startDate = cutoffs['3m'];
                break;
            case '6m':
                startDate = cutoffs['6m'];
                break;
            case '1y':
                startDate = cutoffs['1y'];
                break;
            case 'YTD':
                startDate = cutoffs['YTD'];
                break;
            default:
                return initialData;
        }
        return initialData.filter((d) => new Date(d.date) >= startDate);
    }, [initialData, activeRange, cutoffs]);

    useEffect(() => {
        if (!resolvedTheme || !chartRef.current) return;

        const timerId = setTimeout(() => {
            if (!chartRef.current || !filteredData.length) return;
            const style = getComputedStyle(document.documentElement);
            const fg = `oklch(${style.getPropertyValue('--foreground').trim()})`;
            const border = `oklch(${style.getPropertyValue('--border').trim()})`;

            const isDark = resolvedTheme === 'dark';
            const profitColor = isDark ? '#34D399' : '#059669';
            const lossColor = isDark ? '#F87171' : '#DC2626';

            const labels = filteredData.map((d) => d.date);

            // Determine Market Line Color (Green if Profit, Red if Loss)
            const currentVal = filteredData[filteredData.length - 1]?.price || 0;
            const currentCost = filteredData[filteredData.length - 1]?.costBasis || 0;
            const isProfit = currentVal >= currentCost;
            const marketColor = isProfit ? profitColor : lossColor;

            const datasets = [
                {
                    label: 'Market Value',
                    data: filteredData.map((d) => d.price),
                    borderColor: marketColor,
                    backgroundColor: isProfit
                        ? isDark
                            ? 'rgba(52, 211, 153, 0.1)'
                            : 'rgba(5, 150, 105, 0.1)'
                        : isDark
                          ? 'rgba(248, 113, 113, 0.1)'
                          : 'rgba(220, 38, 38, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    spanGaps: true
                },
                {
                    label: 'Cost Basis',
                    data: filteredData.map((d) => d.costBasis),
                    borderColor: '#71717A', // Zinc-500
                    borderDash: [5, 5], // Dotted Line
                    tension: 0,
                    pointRadius: 0,
                    borderWidth: 2,
                    spanGaps: true
                }
            ];

            const chartOptions: ChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                color: fg,
                interaction: {
                    mode: 'index', // Show both values on hover
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
                        ticks: { color: fg, maxTicksLimit: 6, maxRotation: 45, minRotation: 45 },
                        grid: { color: border }
                    },
                    y: {
                        ticks: {
                            color: fg,
                            callback: (val) =>
                                new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    notation: 'compact'
                                }).format(Number(val))
                        },
                        grid: { color: border }
                    }
                },
                plugins: {
                    legend: { labels: { color: fg } },
                    // pop-up on hover
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD'
                                    }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            };

            if (chartInstanceRef.current) {
                chartInstanceRef.current.data.labels = labels;
                chartInstanceRef.current.data.datasets = datasets;
                chartInstanceRef.current.options = chartOptions;
                chartInstanceRef.current.update('none');
            } else {
                chartInstanceRef.current = new Chart(chartRef.current, {
                    type: 'line',
                    data: { labels, datasets },
                    options: chartOptions
                });
            }
        }, 0);

        return () => clearTimeout(timerId);
    }, [filteredData, resolvedTheme]);

    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, []);

    return (
        <div className='w-full'>
            {/* Time Range Buttons */}
            <div className='mb-4 flex gap-2'>
                {(['1m', '3m', '6m', '1y', 'YTD', 'All'] as TimeRange[]).map((range) => {
                    const isDisabled = range !== 'All' && earliestDate > cutoffs[range];
                    return (
                        <Button
                            key={range}
                            onClick={() => setActiveRange(range)}
                            variant={activeRange === range ? 'default' : 'outline'}
                            size='sm'
                            disabled={isDisabled}
                            className='flex-1 sm:flex-none'
                        >
                            {range.toUpperCase()}
                        </Button>
                    );
                })}
            </div>

            {/* Chart Container */}
            <div className='relative h-[300px] w-full'>
                <canvas ref={chartRef} aria-hidden='true' />
                {/* Add a screen-reader-only table here */}
            </div>
        </div>
    );
}
