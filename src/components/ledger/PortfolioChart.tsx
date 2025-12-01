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

    // Default to '3m' or 'All' based on data length
    const [activeRange, setActiveRange] = useState<TimeRange>('3m');

    const filteredData = useMemo(() => {
        const now = new Date();
        let startDate = new Date();
        switch (activeRange) {
            case '1m':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case '3m':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case '6m':
                startDate.setMonth(now.getMonth() - 6);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'YTD':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                return initialData;
        }
        return initialData.filter((d) => new Date(d.date) >= startDate);
    }, [initialData, activeRange]);

    useEffect(() => {
        if (!resolvedTheme || !chartRef.current) return;

        const style = getComputedStyle(document.documentElement);
        const fg = `oklch(${style.getPropertyValue('--foreground').trim()})`;
        const border = `oklch(${style.getPropertyValue('--border').trim()})`;

        const labels = filteredData.map((d) => d.date);

        // Determine Market Line Color (Green if Profit, Red if Loss)
        const currentVal = filteredData[filteredData.length - 1]?.price || 0;
        const currentCost = filteredData[filteredData.length - 1]?.costBasis || 0;
        const isProfit = currentVal >= currentCost;
        const marketColor = isProfit ? '#10B981' : '#EF4444'; // Emerald vs Red

        const datasets = [
            {
                label: 'Market Value',
                data: filteredData.map((d) => d.price),
                borderColor: marketColor,
                backgroundColor: isProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
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
            chartInstanceRef.current.update();
        } else {
            chartInstanceRef.current = new Chart(chartRef.current, {
                type: 'line',
                data: { labels, datasets },
                options: chartOptions
            });
        }

        return () => {
            // Optional: Don't destroy on every re-render to prevent flicker,
            // but for simple useEffect, destroy is safer.
        };
    }, [filteredData, resolvedTheme]);

    return (
        <div className='w-full'>
            {/* Time Range Buttons */}
            <div className='mb-4 flex gap-2'>
                {(['1m', '3m', '6m', '1y', 'YTD', 'All'] as TimeRange[]).map((range) => (
                    <Button
                        key={range}
                        onClick={() => setActiveRange(range)}
                        variant={activeRange === range ? 'default' : 'outline'}
                        size='sm'
                        className='flex-1 sm:flex-none'
                    >
                        {range.toUpperCase()}
                    </Button>
                ))}
            </div>

            {/* Chart Container */}
            <div className='relative h-[300px] w-full'>
                <canvas ref={chartRef} />
            </div>
        </div>
    );
}
