'use client';
import {
    Chart,
    type ChartOptions,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import { useEffect, useRef, useState, useMemo } from 'react';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';
import 'chartjs-adapter-date-fns';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';

type TimeRange = '1m' | '3m' | '6m' | '1y' | 'YTD' | 'All';

Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Filler,
    Tooltip,
    Legend
);

export function PriceHistoryChart({ cardId }: { cardId: string }) {
    const [initialData, setInitialData] = useState<PriceHistoryDataPoint[] | null>(null);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const { resolvedTheme } = useTheme();
    const [activeRange, setActiveRange] = useState<TimeRange>('All');

    useEffect(() => {
        let cancelled = false;

        const processData = (data: PriceHistoryDataPoint[]) => {
            if (cancelled) return;
            setInitialData(data);
            if (data && data.length > 0) {
                const earliest = new Date(data[0].timestamp).getTime();
                const now = new Date().getTime();
                const diffDays = (now - earliest) / (1000 * 60 * 60 * 24);

                if (diffDays >= 90) setActiveRange('3m');
                else if (diffDays >= 30) setActiveRange('1m');
                else setActiveRange('All');
            }
        };

        const loadFromStore = async (): Promise<boolean> => {
            try {
                const { useHistoryStore } = await import('@/src/lib/store/historyStore');
                const store = useHistoryStore.getState();

                // If idle, trigger initialization but don't block on it for long
                if (store.status === 'idle') {
                    store.initialize();
                }

                let currentStore = useHistoryStore.getState();

                // Wait for store to finish loading (with timeout)
                if (currentStore.status === 'loading') {
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            unsub();
                            resolve();
                        }, 8000); // 8s max wait for history index download
                        const unsub = useHistoryStore.subscribe((state) => {
                            if (state.status !== 'loading') {
                                clearTimeout(timeout);
                                unsub();
                                currentStore = state;
                                resolve();
                            }
                        });
                    });
                }

                if (currentStore.status.startsWith('ready')) {
                    const localData = currentStore.getAllHistory(cardId);
                    if (localData && localData.length > 0) {
                        processData(localData);
                        return true;
                    }
                }
            } catch (err) {
                // Silently fall back to network
            }
            return false;
        };

        const loadFromNetwork = async () => {
            try {
                const res = await fetch(`/api/prices/${cardId}`);
                if (!res.ok) throw new Error('Network response was not ok');
                const data = await res.json();
                processData(data);
            } catch (err) {
                setInitialData([]);
            }
        };

        const loadData = async () => {
            // 1. Try local store first for instant display
            const localSuccess = await loadFromStore();

            // 2. Only use network as fallback if local data wasn't available
            if (!localSuccess && !cancelled) {
                await loadFromNetwork();
            }
        };

        loadData();

        return () => { cancelled = true; };
    }, [cardId]);

    const filteredData = useMemo(() => {
        // Safe-guard for when data hasn't loaded yet
        if (!initialData) return []; 

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
                break;
        }

        let filtered = initialData;
        if (activeRange !== 'All') {
            filtered = initialData.filter((d) => new Date(d.timestamp) >= startDate);
        }

        const dayMap = new Map<string, PriceHistoryDataPoint>();
        for (const d of filtered) {
            const dayKey = new Date(d.timestamp).toISOString().split('T')[0];
            dayMap.set(dayKey, d);
        }
        return Array.from(dayMap.values());
    }, [initialData, activeRange]);

    const earliestDate = useMemo(() => {
        if (!initialData || initialData.length === 0) return new Date();
        return new Date(initialData[0].timestamp); 
    }, [initialData]);

    useEffect(() => {
        if (!resolvedTheme) return;
        
        const timerId = setTimeout(() => {
            if (!chartRef.current || !filteredData || filteredData.length === 0) {
                return;
            }
            const hasData = filteredData.some((d) => 
                d.tcgNormal !== null || 
                d.tcgHolo !== null || 
                d.tcgReverse !== null || 
                d.tcgFirstEdition !== null
            );
            if (!hasData) {
                if (chartInstanceRef.current) {
                    chartInstanceRef.current.destroy();
                    chartInstanceRef.current = null;
                }
                return;
            }

            const style = getComputedStyle(document.documentElement);
            const foregroundColor = `oklch(${style.getPropertyValue('--foreground').trim()})`;
            const borderColor = `oklch(${style.getPropertyValue('--border').trim()})`;

            const labels = filteredData.map((d) => d.timestamp);
            
            // Re-map the datasets to ensure we capture the values
            const rawDatasets = [
                {
                    label: 'Normal',
                    data: filteredData.map((d) => d.tcgNormal),
                    borderColor: '#10B981',
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Holofoil',
                    data: filteredData.map((d) => d.tcgHolo),
                    borderColor: '#6366F1', 
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'Reverse Holofoil',
                    data: filteredData.map((d) => d.tcgReverse),
                    borderColor: '#F59E0B', 
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'First Edition',
                    data: filteredData.map((d) => d.tcgFirstEdition),
                    borderColor: '#EF4444', 
                    tension: 0.1,
                    spanGaps: true
                }
            ];

            // Only add datasets with data
            const datasets = rawDatasets.filter((d) => d.data.some((val) => val !== null));

            let timeUnit: 'day' | 'week' | 'month' = 'day';
            if (filteredData.length > 1) {
                const start = new Date(filteredData[0].timestamp).getTime();
                const end = new Date(filteredData[filteredData.length - 1].timestamp).getTime();
                const diffDays = (end - start) / (1000 * 60 * 60 * 24);
                if (diffDays > 180) timeUnit = 'month';
                else if (diffDays > 30) timeUnit = 'week';
                else timeUnit = 'day';
            }

            const chartOptions: ChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                color: foregroundColor,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: timeUnit,
                            tooltipFormat: 'MMM d, yyyy'
                        },
                        title: { display: false },
                        ticks: {
                            maxTicksLimit: 6,
                            color: foregroundColor,
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            font: { size: 12 }
                        },
                        grid: { color: borderColor }
                    },
                    y: {
                        title: { display: false },
                        ticks: {
                            callback: (value: string | number) => {
                                return new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    notation: 'compact'
                                }).format(Number(value));
                            },
                            color: foregroundColor,
                            font: { size: 12 }
                        },
                        grid: { color: borderColor }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: foregroundColor }
                    },
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
                const chart = chartInstanceRef.current;
                chart.data.labels = labels;
                chart.data.datasets = datasets;
                chart.options = chartOptions;
                chart.update('none');
            } else {
                chartInstanceRef.current = new Chart(chartRef.current, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
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

    const hasData = filteredData.some((d) => 
        d.tcgNormal !== null || 
        d.tcgHolo !== null || 
        d.tcgReverse !== null || 
        d.tcgFirstEdition !== null
    );
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
            {!hasData ? (
                <div
                    style={{ minHeight: '300px' }}
                    className='h-100 flex items-center justify-center rounded-md bg-muted text-sm text-muted-foreground'
                >
                    No price history available for this period.
                </div>
            ) : (
                <div className='relative h-[300px] w-full'>
                    <canvas ref={chartRef} aria-hidden='true' />
                </div>
            )}
        </div>
    );
}