'use client';
import Chart from 'chart.js/auto';
import { useEffect, useRef, useState, useMemo } from 'react';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';
import 'chartjs-adapter-date-fns';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';

interface PriceHistoryChartProps {
    initialData: PriceHistoryDataPoint[];
}

type TimeRange = '1m' | '3m' | '6m' | '1y' | 'YTD' | 'All';

export function PriceHistoryChart({ initialData }: PriceHistoryChartProps) {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const [activeRange, setActiveRange] = useState<TimeRange>('All');
    const { resolvedTheme } = useTheme();

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
            case 'All':
            default:
                return initialData;
        }
        return initialData.filter((d) => new Date(d.timestamp) >= startDate);
    }, [initialData, activeRange]);

    useEffect(() => {
        // Wait for theme to be resolved
        if (!resolvedTheme) {
            return;
        }
        const timerId = setTimeout(() => {
            if (!chartRef.current || !filteredData || filteredData.length === 0) {
                return;
            }
            const hasData = filteredData.some((d) => d.tcgNearMint !== null);
            if (!hasData) {
                return;
            }

            // Get the computed style from the document body
            const style = getComputedStyle(document.documentElement);
            const primaryColor = `hsl(${style.getPropertyValue('--primary')})`;
            const foregroundColor = `hsl(${style.getPropertyValue('--foreground').trim()})`;
            const borderColor = `hsl(${style.getPropertyValue('--border').trim()})`;

            const labels = filteredData.map((d) => d.timestamp);
            const datasets = [
                {
                    label: 'Near Mint',
                    data: filteredData.map((d) => d.tcgNearMint),
                    borderColor: '#10B981', // Green
                    tension: 0.1
                },
                {
                    label: 'Lightly Played',
                    data: filteredData.map((d) => d.tcgLightlyPlayed),
                    borderColor: '#6366F1', // Indigo
                    tension: 0.1,
                    hidden: true // Hide by default
                },
                {
                    label: 'Moderately Played',
                    data: filteredData.map((d) => d.tcgModeratelyPlayed),
                    borderColor: '#F59E0B', // Amber
                    tension: 0.1,
                    hidden: true
                },
                {
                    label: 'Heavily Played',
                    data: filteredData.map((d) => d.tcgHeavilyPlayed),
                    borderColor: '#EF4444', // Red
                    tension: 0.1,
                    hidden: true
                },
                {
                    label: 'Damaged',
                    data: filteredData.map((d) => d.tcgDamaged),
                    borderColor: '#71717A', // Zinc
                    tension: 0.1,
                    hidden: true
                }
                // only add datasets with data
            ].filter((d) => d.data.some((val) => val !== null));

            let timeUnit: 'day' | 'week' | 'month' = 'month';
            if (activeRange === '1m') {
                timeUnit = 'day';
            } else if (activeRange === '3m' || activeRange === '6m') {
                timeUnit = 'week';
            }

            chartInstanceRef.current = new Chart(chartRef.current, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    color: foregroundColor,
                    scales: {
                        x: {
                            type: 'timeseries',
                            time: {
                                unit: timeUnit,
                                tooltipFormat: 'MMM d, yyyy'
                            },
                            title: {
                                display: true,
                                text: 'Date',
                                color: foregroundColor
                            },
                            ticks: {
                                maxTicksLimit: 7,
                                color: foregroundColor
                            },
                            grid: {
                                color: foregroundColor
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Price ($)',
                                color: foregroundColor
                            },
                            ticks: {
                                callback: (value) => `$${value}`,
                                color: foregroundColor
                            },
                            grid: {
                                color: foregroundColor
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: foregroundColor
                            }
                        },
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
                }
            });
        }, 0);

        return () => {
            clearTimeout(timerId);
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [filteredData, activeRange, resolvedTheme]);

    const hasData = filteredData.some((d) => d.tcgNearMint !== null);
    const earliestDate = useMemo(() => {
        if (initialData.length === 0) return new Date();
        return new Date(initialData[0].timestamp); // Assumes data is sorted asc
    }, [initialData]);
    const now = new Date();
    const cutoffs = {
        '1m': new Date(new Date().setMonth(now.getMonth() - 1)),
        '3m': new Date(new Date().setMonth(now.getMonth() - 3)),
        '6m': new Date(new Date().setMonth(now.getMonth() - 6)),
        '1y': new Date(new Date().setFullYear(now.getFullYear() - 1)),
        YTD: new Date(now.getFullYear(), 0, 1)
    };

    return (
        <div>
            <div className='mb-4 flex gap-2'>
                {(['1m', '3m', '6m', '1y', 'YTD', 'All'] as TimeRange[]).map((range) => {
                    // Check if this button should be disabled
                    const isDisabled = range !== 'All' && earliestDate > cutoffs[range];

                    return (
                        <Button
                            key={range}
                            onClick={() => setActiveRange(range)}
                            variant={activeRange === range ? 'default' : 'secondary'}
                            size='sm'
                            disabled={isDisabled}
                        >
                            {range.toUpperCase()}
                        </Button>
                    );
                })}
            </div>
            {!hasData ? (
                <div className='flex h-48 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground'>
                    No price history available for this period.
                </div>
            ) : (
                <canvas ref={chartRef} style={{ minHeight: '300px' }} />
            )}
        </div>
    );
}
