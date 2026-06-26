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

type HistoryStoreState = PersistedState & {
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    int32Data: Int32Array | null;
    initialize: () => Promise<void>;
    getHistory: (cardId: string, variant: string) => { timestamp: string; price: number }[] | null;
    getAllHistory: (cardId: string) => import('@/src/shared-types/price-api').PriceHistoryDataPoint[] | null;
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

                const result: import('@/src/shared-types/price-api').PriceHistoryDataPoint[] = [];

                // Pre-calculate starting offsets and running prices for each variant
                const variants = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;
                const variantData = variants.map(v => ({
                    key: v,
                    offset: cardOffsets[v],
                    runningPrice: 0
                }));

                // First pass: locate the first valid date index
                let firstValidIndex = 0;
                let foundValid = false;

                // We need to simulate running prices up to the first valid index without mutating the actual state objects
                const tempRunningPrices = variantData.map(() => 0);
                
                for (let i = 0; i < dates.length; i++) {
                    let hasValidPoint = false;
                    for (let j = 0; j < variantData.length; j++) {
                        const v = variantData[j];
                        if (v.offset !== undefined) {
                            tempRunningPrices[j] += data[v.offset + i];
                            if (tempRunningPrices[j] > 0) {
                                hasValidPoint = true;
                            }
                        }
                    }
                    if (hasValidPoint) {
                        firstValidIndex = i;
                        foundValid = true;
                        break;
                    }
                }

                if (!foundValid) {
                    return [];
                }

                // Second pass: actually build the array from the first valid index
                for (let i = 0; i < dates.length; i++) {
                    const dataPoint: any = { timestamp: dates[i] };
                    
                    for (const v of variantData) {
                        if (v.offset !== undefined) {
                            v.runningPrice += data[v.offset + i];
                            if (v.runningPrice > 0) {
                                dataPoint[v.key] = v.runningPrice / 100;
                            } else {
                                dataPoint[v.key] = null;
                            }
                        } else {
                            dataPoint[v.key] = null;
                        }
                    }
                    
                    if (i >= firstValidIndex) {
                        result.push(dataPoint as import('@/src/shared-types/price-api').PriceHistoryDataPoint);
                    }
                }

                return result;
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
