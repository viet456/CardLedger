import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import {
    NormalizedCard,
    DenormalizedCard,
    PointerFile,
    LookupTables,
    FullCardData
} from '@/src/shared-types/card-index';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

type StoreStatus =
    | 'idle'
    | 'loading_cache'
    | 'loading_network'
    | 'ready_from_cache'
    | 'ready_from_network'
    | 'error';

// Saved to Zustand
type PersistedState = LookupTables & {
    cards: NormalizedCard[];
    version: string | null;
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

type CardStoreState = LookupTables & {
    cards: NormalizedCard[];
    version: string | null;
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    initialize: () => Promise<void>;
};

// copies IndexedDB to faster Zustand store
export const useCardStore = create<CardStoreState>()(
    persist(
        (set, get) => ({
            supertypes: [],
            rarities: [],
            sets: [],
            types: [],
            subtypes: [],
            artists: [],
            cards: [],
            abilities: [],
            version: null,
            status: 'idle',

            // Checks for local cards in Indexeddb and compares to fetched version
            initialize: async () => {
                if (get().status.startsWith('loading') || get().status.startsWith('ready')) {
                    return;
                }
                console.log('[Store]: Initializing card data...');
                set({ status: 'loading' });

                try {
                    console.log('[Store]: Fetching pointer file...');
                    const pointerRes = await fetch(
                        `${R2_PUBLIC_URL}/indices/card-index.current.json`
                    );
                    if (!pointerRes.ok) throw new Error('Failed to fetch pointer file.');
                    const pointer: PointerFile = await pointerRes.json();
                    console.log(
                        `[Store]: Latest version is ${pointer.version}. Local version is ${get().version || 'none'}.`
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
                    console.log('[Store]: Download complete. Verifying checksum...');
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
                    console.log('[Store]: ✅ Checksum validation successful.');

                    const fullData: FullCardData = JSON.parse(cardsDataString);
                    console.log(
                        `[Store]: ✅ Loaded ${fullData.cards.length} cards from network. Updating state.`
                    );
                    set({ ...fullData, status: 'ready_from_network' });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : 'An unknown error occurred';
                    console.error(`[Store]: ❌ Error during initialization: ${errorMessage}`);
                    set({ status: 'error' });
                }
            }
        }),
        {
            name: 'card-data-storage',
            storage: indexedDbStorage,
            partialize: (state): PersistedState => ({
                artists: state.artists,
                rarities: state.rarities,
                sets: state.sets,
                types: state.types,
                subtypes: state.subtypes,
                supertypes: state.supertypes,
                cards: state.cards,
                abilities: state.abilities,
                version: state.version
            })
        }
    )
);
