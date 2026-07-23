import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del, setMany } from 'idb-keyval';
import { HistoryIndex, HistoryPointerFile } from '@/src/shared-types/price-api';

/**
 * Price History Store
 * 
 * Data pipeline:
 * 1. Server builds a monolithic Int32Array of delta-encoded price deltas for all cards/variants
 *    + a HistoryIndex JSON with dates[] and per-card byte offsets. Both hosted on R2.
 * 2. On first visit, initialize() downloads both files, checksums them, then slices the
 *    monolithic buffer into per-card entries and writes them to IndexedDB (hist-card-{id}).
 *    The 183MB buffer is discarded after slicing — only index metadata stays in Zustand.
 * 3. On card page visit, getAllHistory()/getLatestPrices() read the per-card entry from IDB,
 *    create Int32Array views, accumulate deltas, and return decoded data points.
 * 4. LRU cache (10 cards) avoids repeated IDB reads for recently visited cards.
 */


const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://assets.cardledger.io';

// The state we store in IndexedDB (no buffer — per-card entries live separately in IDB)
type PersistedState = {
    version: string | null;
    index: HistoryIndex | null;
};

type PriceHistoryDataPoint = import('@/src/shared-types/price-api').PriceHistoryDataPoint;

// LRU cache: holds decompressed full history arrays for at most N cards.
// Avoids repeated IDB reads for recently visited cards.
const HISTORY_CACHE_MAX = 10;
const historyCache = new Map<string, PriceHistoryDataPoint[]>();
export function getCachedHistory(cardId: string): PriceHistoryDataPoint[] | undefined {
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
    initialize: () => Promise<void>;
    getHistory: (cardId: string, variant: string) => Promise<{ timestamp: string; price: number }[] | null>;
    getAllHistory: (cardId: string) => Promise<PriceHistoryDataPoint[] | null>;
    getLatestPrices: (cardId: string) => Promise<PriceHistoryDataPoint[] | null>;
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

// IDB key prefix for per-card history entries
const CARD_KEY_PREFIX = 'hist-card-';
const SLICE_CHUNK_SIZE = 500;

export const useHistoryStore = create<HistoryStoreState>()(
    persist(
        (set, getStore) => ({
            version: null,
            index: null,
            status: 'idle',

            initialize: async () => {
                if (getStore().status.startsWith('loading') || getStore().status.startsWith('ready')) {
                    return;
                }
                set({ status: 'loading' });

                try {
                    const pointerRes = await fetch(`${R2_PUBLIC_URL}/history/history-index.current.json`, { cache: 'no-store' });
                    if (!pointerRes.ok) throw new Error('Failed to fetch history pointer file.');
                    const pointer: HistoryPointerFile = await pointerRes.json();

                    if (getStore().version === pointer.version) {
                        // Verify per-card data actually exists (handles IDB clear scenarios)
                        const sampleCardId = Object.keys(getStore().index?.offsets || {})[0];
                        if (sampleCardId) {
                            const sample = await get(`${CARD_KEY_PREFIX}${sampleCardId}`);
                            if (sample) {
                                set({ status: 'ready_from_cache' });
                                return;
                            }
                        }
                        // Per-card data missing despite version match — fall through to re-download
                    }

                    // Fetch Index JSON
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

                    // Slice the monolithic buffer into per-card IDB entries
                    // Each entry stores variant deltas as ArrayBuffers keyed by variant name
                    const numDates = indexData.dates.length;
                    const cardEntries = Object.entries(indexData.offsets);

                    for (let i = 0; i < cardEntries.length; i += SLICE_CHUNK_SIZE) {
                        const chunk: [string, Record<string, ArrayBuffer>][] = [];
                        const batch = cardEntries.slice(i, i + SLICE_CHUNK_SIZE);

                        for (const [cardId, cardOffsets] of batch) {
                            const cardData: Record<string, ArrayBuffer> = {};
                            for (const [variant, offset] of Object.entries(cardOffsets)) {
                                // offset is in Int32 element units; convert to bytes for slicing
                                cardData[variant] = dataBuffer.slice(offset * 4, (offset + numDates) * 4);
                            }
                            chunk.push([`${CARD_KEY_PREFIX}${cardId}`, cardData]);
                        }

                        // Write chunk to IDB in a single transaction
                        await setMany(chunk);
                    }

                    // Store index + version in Zustand (no buffer)
                    set({
                        version: pointer.version,
                        index: indexData,
                        status: 'ready_from_network'
                    });
                } catch (error) {
                    console.error(`[HistoryStore]: ❌ Error during initialization:`, error);
                    if (error instanceof Error && error.name === 'QuotaExceededError') {
                        console.error('[HistoryStore] IndexedDB Quota Exceeded!');
                    }
                    const state = getStore();
                    if (state.version && state.index) {
                        set({ status: 'ready_from_cache' });
                    } else {
                        set({ status: 'error' });
                    }
                }
            },

            getHistory: async (cardId: string, variant: string) => {
                const state = getStore();
                if (!state.index) return null;

                const cardData: Record<string, ArrayBuffer> | undefined = await get(`${CARD_KEY_PREFIX}${cardId}`);
                if (!cardData || !cardData[variant]) return null;

                const deltas = new Int32Array(cardData[variant]);
                const dates = state.index.dates;

                const result = [];
                let runningPrice = 0;

                for (let i = 0; i < dates.length; i++) {
                    runningPrice += deltas[i];
                    result.push({
                        timestamp: dates[i],
                        price: runningPrice > 0 ? runningPrice / 100 : 0
                    });
                }

                return result;
            },

            getAllHistory: async (cardId: string) => {
                // Check LRU cache first
                const cached = getCachedHistory(cardId);
                if (cached !== undefined) return cached;

                const state = getStore();
                if (!state.index) return null;

                // Read per-card data from IDB
                const cardData: Record<string, ArrayBuffer> | undefined = await get(`${CARD_KEY_PREFIX}${cardId}`);
                if (!cardData) return null;

                const dates = state.index.dates;
                const variants = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;

                // Convert stored ArrayBuffers to Int32Arrays
                const variantDeltas: Record<string, Int32Array> = {};
                for (const [key, buf] of Object.entries(cardData)) {
                    variantDeltas[key] = new Int32Array(buf);
                }

                // Build offset + running state for each variant
                const variantStates = variants.map(v => ({
                    key: v,
                    deltas: variantDeltas[v] || null,
                    runningPrice: 0
                }));

                // Single pass: find first valid index while accumulating, then start pushing
                let firstValidIndex = -1;
                const result: PriceHistoryDataPoint[] = [];

                for (let i = 0; i < dates.length; i++) {
                    let hasValidPoint = false;

                    for (const vs of variantStates) {
                        if (vs.deltas) {
                            vs.runningPrice += vs.deltas[i];
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
                        if (vs.deltas && vs.runningPrice > 0) {
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

            getLatestPrices: async (cardId: string) => {
                // Check LRU cache first
                const cached = getCachedHistory(cardId);
                if (cached !== undefined) {
                    // Return last 2 points from cached full data
                    return cached.length > 1 ? cached.slice(-2) : cached.length > 0 ? cached : null;
                }

                const state = getStore();
                if (!state.index) return null;

                // Read per-card data from IDB
                const cardData: Record<string, ArrayBuffer> | undefined = await get(`${CARD_KEY_PREFIX}${cardId}`);
                if (!cardData) return null;

                const dates = state.index.dates;
                const variants = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;
                const numDates = dates.length;

                // Convert stored ArrayBuffers to Int32Arrays
                const variantDeltas: Record<string, Int32Array> = {};
                for (const [key, buf] of Object.entries(cardData)) {
                    variantDeltas[key] = new Int32Array(buf);
                }

                const variantStates = variants.map(v => ({
                    key: v,
                    deltas: variantDeltas[v] || null,
                    runningPrice: 0
                }));

                // Compute total sums first
                for (const vs of variantStates) {
                    if (vs.deltas) {
                        let sum = 0;
                        for (let i = 0; i < numDates; i++) {
                            sum += vs.deltas[i];
                        }
                        vs.runningPrice = sum;
                    }
                }

                // Now find last 2 valid points by scanning backwards
                const searchWindow = Math.min(numDates, 30); // Only scan last 30 dates
                const startIdx = numDates - searchWindow;

                // Rebuild running prices from 0 to startIdx
                const baseRunningPrices = variantStates.map(vs => {
                    if (!vs.deltas) return 0;
                    let sum = 0;
                    for (let i = 0; i < startIdx; i++) {
                        sum += vs.deltas[i];
                    }
                    return sum;
                });

                const recentPoints: PriceHistoryDataPoint[] = [];
                const runningPrices = [...baseRunningPrices];

                for (let i = startIdx; i < numDates; i++) {
                    let hasValidPoint = false;
                    for (let j = 0; j < variantStates.length; j++) {
                        if (variantStates[j].deltas) {
                            runningPrices[j] += variantStates[j].deltas[i];
                            if (runningPrices[j] > 0) hasValidPoint = true;
                        }
                    }
                    if (!hasValidPoint) continue;

                    const dataPoint: any = { timestamp: dates[i] };
                    for (let j = 0; j < variantStates.length; j++) {
                        if (variantStates[j].deltas && runningPrices[j] > 0) {
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
                index: state.index
            })
        }
    )
);