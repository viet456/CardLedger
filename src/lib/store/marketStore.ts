import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { MarketStats } from '@/src/shared-types/price-api';
import { PointerFile } from '@/src/shared-types/card-index';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

// Saved to Zustand in memory
type PersistedState = MarketStats & {
    version: string | null;
};

type MarketStoreState = MarketStats & {
    version: string | null;
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    initialize: () => Promise<void>;
};

const indexedDbStorage: PersistStorage<PersistedState> = {
    getItem: async (name: string): Promise<{ state: PersistedState; version: number } | null> => {
        console.log(`[IndexedDB]: Reading '${name}'...`);
        const item = (await get(name)) || null;
        console.log('[IndexedDB]: Read complete.', item ? 'Data found.' : 'No data found.');
        return item;
    },
    setItem: async (name: string, value: StorageValue<PersistedState>): Promise<void> => {
        console.log(`[IndexedDB]: Writing to '${name}'...`);
        await set(name, value);
        console.log('[IndexedDB]: Write complete.');
    },
    removeItem: async (name: string) => {
        await del(name);
    }
};

// copies IndexedDB to faster Zustand store
export const useMarketStore = create<MarketStoreState>()(
    persist(
        (set, get) => ({
            prices: {},
            version: null,
            status: 'idle',

            initialize: async () => {
                if (get().status.startsWith('loading') || get().status.startsWith('ready')) {
                    return;
                }
                console.log('[MarketStore]: Initializing current price data...');
                set({ status: 'loading' });

                // Check if our stored version is the same as the last created JSON
                try {
                    console.log('[MarketStore]: Fetching pointer file...');
                    const pointerRes = await fetch(
                        `${R2_PUBLIC_URL}/market/market-index.current.json`
                    );
                    if (!pointerRes.ok) throw new Error("Failed to fetch market's pointer file.");
                    const pointer: PointerFile = await pointerRes.json();
                    console.log(
                        `[MarketStore]: Latest version is ${pointer.version}. Local version is ${get().version || 'none'}.`
                    );

                    // Check if our stored version is the same as the last created JSON
                    if (get().version === pointer.version) {
                        console.log(' ✅ Local data is up-to-date. Using IndexedDB cache.');
                        set({ status: 'ready_from_cache' });
                        return;
                    }

                    console.log('New data version found. Fetching from network...');
                    const cardsRes = await fetch(pointer.url);
                    if (!cardsRes.ok) throw new Error('Failed to fetch card data artifact.');
                    console.log('[MarketStore]: Download complete. Verifying checksum...');
                    const cardsDataString = await cardsRes.text();

                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(cardsDataString);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const calculatedCheckSum = hashArray
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('');

                    if (calculatedCheckSum !== pointer.checkSum) {
                        throw new Error('Checksum validation failed! Data is corrupt.');
                    }
                    console.log('[MarketStore]: ✅ Checksum validation successful.');

                    const fullData: PersistedState = JSON.parse(cardsDataString);
                    console.log(
                        `[MarketStore]: ✅ Loaded ${Object.keys(fullData.prices).length} card prices from network. Updating state.`
                    );
                    set({ ...fullData, status: 'ready_from_network' });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : 'An unknown error occurred';
                    console.error(`[MarketStore]: ❌ Error during initialization: ${errorMessage}`);
                    set({ status: 'error' });
                }
            }
        }),
        {
            name: 'market-data-store',
            storage: indexedDbStorage,
            partialize: (state): PersistedState => ({
                prices: state.prices,
                version: state.version
            })
        }
    )
);
