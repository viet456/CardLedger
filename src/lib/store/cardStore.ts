import { create } from 'zustand/react';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import {
    NormalizedCard,
    PointerFile,
    LookupTables,
    FullCardData
} from '@/src/shared-types/card-index';
import uFuzzy from '@leeoniya/ufuzzy';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

// Front-end type with index for fastest sorting when multiple filters selected
// Ensures intersected filter maps return cards sorted, quickly
export type IndexedCard = NormalizedCard & { _index: number };

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

// Index maps for searching and filtering over
type IndexMap = Map<string, Set<string>>;

export type CardStoreState = LookupTables & {
    cards: NormalizedCard[];
    version: string | null;
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    initialize: () => Promise<void>;

    cardMap: Map<string, IndexedCard>;
    rarityIndex: IndexMap;
    setIndex: IndexMap;
    typeIndex: IndexMap;
    subtypeIndex: IndexMap;
    artistIndex: IndexMap;
    weaknessIndex: IndexMap;
    resistanceIndex: IndexMap;

    ufInstance: uFuzzy | null;
    searchHaystack: string[];
};

// Relevance sort: shortest matches first
const customSort = (info: any, haystack: string[], needle: string) => {
    const { idx, start } = info;
    const order = new Array(idx.length);
    for (let i = 0; i < idx.length; i++) order[i] = i;

    order.sort((a, b) => {
        // Prioritize starts-with (lower start index is better)
        if (start[a] !== start[b]) {
            return start[a] - start[b];
        }

        // If start is tied, prioritize shortest string (closer to exact match)
        const lenA = haystack[idx[a]].length;
        const lenB = haystack[idx[b]].length;

        return lenA - lenB;
    });

    return order;
};

const ufOptions = {
    // intraMode: 1 allows for partial matches inside words (crucial for IDs like 'sv1-001')
    intraMode: 1,
    // Optimize for standard latin characters + numbers
    intraChars: '[a-z0-9]',
    sort: customSort
};

// Helper function to build search indexes
function buildIndexes(fullData: FullCardData) {
    const cardMap = new Map<string, IndexedCard>();
    const rarityIndex: IndexMap = new Map();
    const setIndex: IndexMap = new Map();
    const typeIndex: IndexMap = new Map();
    const subtypeIndex: IndexMap = new Map();
    const artistIndex: IndexMap = new Map();
    const weaknessIndex: IndexMap = new Map();
    const resistanceIndex: IndexMap = new Map();

    const { rarities, sets, types, subtypes, artists } = fullData;

    const searchHaystack: string[] = [];

    const addToIndex = (index: IndexMap, key: string, cardId: string) => {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key)!.add(cardId);
    };
    for (let i = 0; i < fullData.cards.length; i++) {
        const card = fullData.cards[i];
        cardMap.set(card.id, { ...card, _index: i });
        searchHaystack.push(`${card.n} ${card.id}`);

        if (card.r !== null) {
            addToIndex(rarityIndex, rarities[card.r], card.id);
        }
        if (card.s !== null) {
            addToIndex(setIndex, sets[card.s].id, card.id);
        }
        for (const typeId of card.t) {
            addToIndex(typeIndex, types[typeId], card.id);
        }
        for (const subtypeId of card.sb) {
            addToIndex(subtypeIndex, subtypes[subtypeId], card.id);
        }
        if (card.a !== null) {
            addToIndex(artistIndex, artists[card.a], card.id);
        }
        for (const weakness of card.w || []) {
            addToIndex(weaknessIndex, types[weakness.t], card.id);
        }
        for (const resistance of card.rs || []) {
            addToIndex(resistanceIndex, types[resistance.t], card.id);
        }
    }

    //console.log('[CardStore]: Building uFuzzy index...');
    const ufInstance = new uFuzzy(ufOptions);
    //console.log('[CardStore]: ✅ uFuzzy index built.');

    return {
        cardMap,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex,
        ufInstance,
        searchHaystack
    };
}

const indexedDbStorage: PersistStorage<PersistedState> = {
    getItem: async (name: string): Promise<{ state: PersistedState; version: number } | null> => {
        //console.log(`[IndexedDB]: Reading '${name}'...`);
        const item = (await get(name)) || null;
        //console.log('[IndexedDB]: Read complete.', item ? 'Data found.' : 'No data found.');
        return item;
    },
    setItem: async (name: string, value: StorageValue<PersistedState>): Promise<void> => {
        //console.log(`[IndexedDB]: Writing to '${name}'...`);
        await set(name, value);
        //console.log('[IndexedDB]: Write complete.');
    },
    removeItem: async (name: string) => {
        await del(name);
    }
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
            attacks: [],
            rules: [],
            weaknesses: [],
            resistances: [],
            ufInstance: null,
            searchHaystack: [],
            version: null,
            status: 'idle',
            cardMap: new Map(),
            rarityIndex: new Map(),
            setIndex: new Map(),
            typeIndex: new Map(),
            subtypeIndex: new Map(),
            artistIndex: new Map(),
            weaknessIndex: new Map(),
            resistanceIndex: new Map(),

            // Checks for local cards in Indexeddb and compares to fetched version
            initialize: async () => {
                if (get().status.startsWith('loading') || get().status.startsWith('ready')) {
                    return;
                }
                //console.log('[CardStore]: Initializing card data...');
                set({ status: 'loading' });

                try {
                    //console.log('[CardStore]: Fetching pointer file...');
                    const pointerRes = await fetch(
                        `${R2_PUBLIC_URL}/indices/card-index.current.json`
                    );
                    if (!pointerRes.ok) throw new Error("Failed to fetch card's pointer file.");
                    const pointer: PointerFile = await pointerRes.json();
                    // console.log(
                    //     `[CardStore]: Latest version is ${pointer.version}. Local version is ${get().version || 'none'}.`
                    // );

                    // Check if our stored version is the same as the last created JSON
                    if (get().version === pointer.version) {
                        //console.log('✅ Local data is up-to-date. Using cache.');
                        set({ status: 'ready_from_cache' });
                        return;
                    }

                    //console.log('New data version found. Fetching from network...');
                    const cardsRes = await fetch(pointer.url);
                    if (!cardsRes.ok) throw new Error('Failed to fetch card data artifact.');
                    //console.log('[CardStore]: Download complete. Verifying checksum...');
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
                    //console.log('[CardStore]: ✅ Checksum validation successful.');

                    const fullData: FullCardData = JSON.parse(cardsDataString);

                    // Build card filter indexes
                    //console.log('[CardStore]: Building indexes from network data...');
                    const indexes = buildIndexes(fullData);

                    // console.log(
                    //     `[CardStore]: ✅ Loaded ${fullData.cards.length} cards from network. Updating state.`
                    // );
                    set({ ...fullData, ...indexes, status: 'ready_from_network' });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : 'An unknown error occurred';
                    console.error(`[CardStore]: ❌ Error during initialization: ${errorMessage}`);
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
                attacks: state.attacks,
                rules: state.rules,
                weaknesses: state.weaknesses,
                resistances: state.resistances,
                version: state.version
            }),
            // Build indexes after rehydration from storage
            onRehydrateStorage: () => (state) => {
                if (state && state.cards.length > 0) {
                    //console.log('[CardStore]: Building indexes after rehydration...');
                    const indexes = buildIndexes(state as FullCardData);
                    state.cardMap = indexes.cardMap;
                    state.rarityIndex = indexes.rarityIndex;
                    state.setIndex = indexes.setIndex;
                    state.typeIndex = indexes.typeIndex;
                    state.subtypeIndex = indexes.subtypeIndex;
                    state.artistIndex = indexes.artistIndex;
                    state.weaknessIndex = indexes.weaknessIndex;
                    state.resistanceIndex = indexes.resistanceIndex;
                    state.ufInstance = indexes.ufInstance;
                    state.searchHaystack = indexes.searchHaystack;
                    //console.log('[CardStore]: ✅ Indexes built from rehydrated data.');
                }
            }
        }
    )
);
