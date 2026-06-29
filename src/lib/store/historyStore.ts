import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { HistoryIndex, HistoryPointerFile } from '@/src/shared-types/price-api';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://assets.cardledger.io';

// The state we store in IndexedDB
type PersistedState = {
    version: string | null;
    index: HistoryIndex | null;
    buffer: ArrayBuffer | null;
};

type PriceHistoryDataPoint = import('@/src/shared-types/price-api').PriceHistoryDataPoint;

// LRU cache: holds decompressed full history arrays for at most N cards.
// When a new card is added and the cache is full, the oldest entry is evicted,
// so at most ~10 cards' worth of decompressed data stays in memory at a time.
const HISTORY_CACHE_MAX = 10;
const historyCache = new Map<string, PriceHistoryDataPoint[]>();
function getCachedHistory(cardId: string): PriceHistoryDataPoint[] | undefined {
    const cached = historyCache.get(cardId);
    if (cached !== undefined) {
        // Move to end (most recently used)
        historyCache.delete(cardId);
        historyCache.set(cardId, cached);
    }
    return cached;
}
function setCachedHistory(cardId: string, data: PriceHistoryDataPoint[]): void {
    historyCache.delete(cardId);
    historyCache.set(cardId, data);
    // Evict oldest entries if over limit
    while (historyCache.size > HISTORY_CACHE_MAX) {
        const oldest = historyCache.keys().next().value;
        if (oldest !== undefined) historyCache.delete(oldest);
    }
}

type HistoryStoreState = PersistedState & {
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    int32Data: Int32Array | null;
    initialize: () => Promise<void>;
    getHistory: (cardId: string, variant: string) => { timestamp: string; price: number }[] | null;
    getAllHistory: (cardId: string) => PriceHistoryDataPoint[] | null;
    getLatestPrices: (cardId: string) => PriceHistoryDataPoint[] | null;
};

const indexedDbStorage: PersistStorage<PersistedState> = {
    getItem: async (name: string): Promise<{ state: PersistedState; version: number } | null> => {
        const item = (await get(name)) || null;
        return item;
    },
    setItem: async (name: string, value: StorageValue<PersistedState>): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string) => {
        await del(name);
    }
};

export const useHistoryStore = create<HistoryStoreState>()(
    persist(
        (set, getStore) => ({
            version: null,
            index: null,
            buffer: null,
            status: 'idle',
            int32Data: null,

            initialize: async () => {
                if (getStore().status.startsWith('loading') || getStore().status.startsWith('ready')) {
                    // Try to re-hydrate int32Data if it's missing but buffer exists
                    const state = getStore();
                    if (!state.int32Data && state.buffer) {
                        set({ int32Data: new Int32Array(state.buffer) });
                    }
                    return;
                }
                set({ status: 'loading' });

                try {
                    const pointerRes = await fetch(`${R2_PUBLIC_URL}/history/history-index.current.json`);
                    if (!pointerRes.ok) throw new Error('Failed to fetch history pointer file.');
                    const pointer: HistoryPointerFile = await pointerRes.json();

                    if (getStore().version === pointer.version) {
                        const buffer = getStore().buffer;
                        if (buffer) {
                            set({ status: 'ready_from_cache', int32Data: new Int32Array(buffer) });
                            return;
                        }
                    }

                    // Fetch Index JSON
                    // Ensure the URL utilizes the R2 domain if it's an absolute path
                    const indexUrl = pointer.indexUrl.startsWith('http') ? pointer.indexUrl : `${R2_PUBLIC_URL}${pointer.indexUrl.startsWith('/') ? '' : '/'}${pointer.indexUrl}`;
                    const indexRes = await fetch(indexUrl);
                    if (!indexRes.ok) throw new Error('Failed to fetch history index artifact.');
                    const indexDataString = await indexRes.text();

                    const indexEncoder = new TextEncoder();
                    const indexDataBuffer = indexEncoder.encode(indexDataString);
                    const indexHashBuffer = await crypto.subtle.digest('SHA-256', indexDataBuffer);
                    const indexHashArray = Array.from(new Uint8Array(indexHashBuffer));
                    const indexCheckSum = indexHashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

                    if (indexCheckSum !== pointer.indexCheckSum) {
                        throw new Error('Index checksum validation failed! Data is corrupt.');
                    }

                    const indexData: HistoryIndex = JSON.parse(indexDataString);

                    // Fetch Binary ArrayBuffer
                    const dataUrl = pointer.dataUrl.startsWith('http') ? pointer.dataUrl : `${R2_PUBLIC_URL}${pointer.dataUrl.startsWith('/') ? '' : '/'}${pointer.dataUrl}`;
                    const dataRes = await fetch(dataUrl);
                    if (!dataRes.ok) throw new Error('Failed to fetch history binary artifact.');
                    const dataBuffer = await dataRes.arrayBuffer();

                    const dataHashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
                    const dataHashArray = Array.from(new Uint8Array(dataHashBuffer));
                    const dataCheckSum = dataHashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

                    if (dataCheckSum !== pointer.dataCheckSum) {
                        throw new Error('Data checksum validation failed! Data is corrupt.');
                    }

                    set({
                        version: pointer.version,
                        index: indexData,
                        buffer: dataBuffer,
                        int32Data: new Int32Array(dataBuffer),
                        status: 'ready_from_network'
                    });
                } catch (error) {
                    console.error(`[HistoryStore]: ❌ Error during initialization:`, error);
                    if (error instanceof Error && error.name === 'QuotaExceededError') {
                        console.error('[HistoryStore] IndexedDB Quota Exceeded! The history buffer is likely too large for this browsing mode (e.g. Incognito).');
                    }
                    const state = getStore();
                    if (state.version && state.buffer && state.index) {
                        set({ 
                            status: 'ready_from_cache', 
                            int32Data: state.int32Data || new Int32Array(state.buffer) 
                        });
                    } else {
                        set({ status: 'error' });
                    }
                }
            },

            getHistory: (cardId: string, variant: string) => {
                const state = getStore();
                
                let data = state.int32Data;
                if (!data && state.buffer) {
                    data = new Int32Array(state.buffer);
                    set({ int32Data: data });
                }

                if (!state.index || !data) return null;

                const cardOffsets = state.index.offsets[cardId];
                if (!cardOffsets) return null;

                const offset = cardOffsets[variant];
                if (offset === undefined) return null;

                const dates = state.index.dates;

                const result = [];
                let runningPrice = 0;

                for (let i = 0; i < dates.length; i++) {
                    const delta = data[offset + i];
                    runningPrice += delta;
                    
                    result.push({
                        timestamp: dates[i],
                        price: runningPrice > 0 ? runningPrice / 100 : 0 // Technically getHistory is barely used, but we keep it safe
                    });
                }

                return result;
            },

            getAllHistory: (cardId: string) => {
                // Check LRU cache first
                const cached = getCachedHistory(cardId);
                if (cached !== undefined) return cached;

                const state = getStore();
                
                // If we have buffer but no int32Data, set it up first
                let data = state.int32Data;
                if (!data && state.buffer) {
                    data = new Int32Array(state.buffer);
                    set({ int32Data: data });
                }

                if (!state.index || !data) {
                    return null;
                }

                const cardOffsets = state.index.offsets[cardId];
                if (!cardOffsets) return null;

                const dates = state.index.dates;
                const variants = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;

                // Build offset + running state for each variant
                const variantStates = variants.map(v => ({
                    key: v,
                    offset: cardOffsets[v],
                    runningPrice: 0
                }));

                // Single pass: find first valid index while accumulating, then start pushing
                let firstValidIndex = -1;
                const result: PriceHistoryDataPoint[] = [];

                for (let i = 0; i < dates.length; i++) {
                    let hasValidPoint = false;

                    for (const vs of variantStates) {
                        if (vs.offset !== undefined) {
                            vs.runningPrice += data[vs.offset + i];
                            if (vs.runningPrice > 0) hasValidPoint = true;
                        }
                    }

                    if (firstValidIndex === -1) {
                        if (hasValidPoint) firstValidIndex = i;
                        continue; // Skip building data points until we have valid data
                    }

                    // Build data point only for valid range
                    const dataPoint: any = { timestamp: dates[i] };
                    for (const vs of variantStates) {
                        if (vs.offset !== undefined && vs.runningPrice > 0) {
                            dataPoint[vs.key] = vs.runningPrice / 100;
                        } else {
                            dataPoint[vs.key] = null;
                        }
                    }
                    result.push(dataPoint as PriceHistoryDataPoint);
                }

                setCachedHistory(cardId, result);
                return result;
            },

            getLatestPrices: (cardId: string) => {
                // Check LRU cache first
                const cached = getCachedHistory(cardId);
                if (cached !== undefined) {
                    // Return last 2 points from cached full data
                    return cached.length > 1 ? cached.slice(-2) : cached.length > 0 ? cached : null;
                }

                const state = getStore();
                
                let data = state.int32Data;
                if (!data && state.buffer) {
                    data = new Int32Array(state.buffer);
                    set({ int32Data: data });
                }

                if (!state.index || !data) return null;

                const cardOffsets = state.index.offsets[cardId];
                if (!cardOffsets) return null;

                const dates = state.index.dates;
                const variants = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;
                const numDates = dates.length;

                // Scan backwards from the end to find the last 2 points with any valid data
                const variantStates = variants.map(v => ({
                    key: v,
                    offset: cardOffsets[v],
                    // We'll compute cumulative sums from the end backwards
                    runningPrice: 0
                }));

                // Compute total sums first
                for (const vs of variantStates) {
                    if (vs.offset !== undefined) {
                        let sum = 0;
                        for (let i = 0; i < numDates; i++) {
                            sum += data[vs.offset + i];
                        }
                        vs.runningPrice = sum;
                    }
                }

                // Now find last 2 valid points by scanning backwards
                // We need to reconstruct running prices at each point going backwards
                // Instead, let's just build the last portion efficiently
                const searchWindow = Math.min(numDates, 30); // Only scan last 30 dates
                const startIdx = numDates - searchWindow;

                // Rebuild running prices from 0 to startIdx
                const baseRunningPrices = variantStates.map(vs => {
                    if (vs.offset === undefined) return 0;
                    let sum = 0;
                    for (let i = 0; i < startIdx; i++) {
                        sum += data[vs.offset + i];
                    }
                    return sum;
                });

                const recentPoints: PriceHistoryDataPoint[] = [];
                const runningPrices = [...baseRunningPrices];

                for (let i = startIdx; i < numDates; i++) {
                    let hasValidPoint = false;
                    for (let j = 0; j < variantStates.length; j++) {
                        if (variantStates[j].offset !== undefined) {
                            runningPrices[j] += data[variantStates[j].offset + i];
                            if (runningPrices[j] > 0) hasValidPoint = true;
                        }
                    }
                    if (!hasValidPoint) continue;

                    const dataPoint: any = { timestamp: dates[i] };
                    for (let j = 0; j < variantStates.length; j++) {
                        if (variantStates[j].offset !== undefined && runningPrices[j] > 0) {
                            dataPoint[variantStates[j].key] = runningPrices[j] / 100;
                        } else {
                            dataPoint[variantStates[j].key] = null;
                        }
                    }
                    recentPoints.push(dataPoint as PriceHistoryDataPoint);
                }

                return recentPoints.length > 0 ? recentPoints : null;
            }
        }),
        {
            name: 'history-data-store',
            storage: indexedDbStorage,
            partialize: (state): PersistedState => ({
                version: state.version,
                index: state.index,
                buffer: state.buffer
            }),
            onRehydrateStorage: () => (state) => {
                if (state && state.buffer) {
                    // Note: Cannot mutate state here, so we defer setting int32Data
                    useHistoryStore.setState({ int32Data: new Int32Array(state.buffer) });
                }
            }
        }
    )
);
