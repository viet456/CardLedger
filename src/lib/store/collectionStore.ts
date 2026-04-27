import { create } from 'zustand/react';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { CollectionEntry, CardVariant } from '@prisma/client';
import { trpcClient } from '@/src/utils/trpc';
import { toast } from 'sonner';

export type FrontendCollectionEntry = Omit<CollectionEntry, 'purchasePrice'> & {
    purchasePrice: number;
};

type PersistedState = {
    userId: string | null;
    entries: FrontendCollectionEntry[];
    lastSynced: number | null; // Timestamp from server
    version: string | null; // Hash or timestamp
    offline_mutations: OfflineMutation[];
};

type CollectionEntryInput = {
    cardId: string;
    purchasePrice: number; // UI sends a number
    variant?: CardVariant;
};

export type CollectionStoreState = PersistedState & {
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    initialize: (userId: string) => Promise<void>;
    addEntry: (entry: CollectionEntryInput) => Promise<void>;
    updateEntry: (entryId: string, updates: Partial<FrontendCollectionEntry>) => Promise<void>;
    removeEntry: (entryId: string) => Promise<void>;
    setEntries: (entries: FrontendCollectionEntry[]) => void;
    clearStore: () => void;
    processQueue: () => Promise<void>;
};

const indexedDbStorage: PersistStorage<PersistedState> = {
    getItem: async (name: string) => {
        const item = (await get(name)) || null;
        return item;
    },
    setItem: async (name: string, value: StorageValue<PersistedState>) => {
        await set(name, value);
    },
    removeItem: async (name: string) => {
        await del(name);
    }
};

// Offline mutation queue types
// Queue up the collection changes to be pushed to the server when online
export type OfflineMutation =
    | { type: 'ADD'; tempId: string; payload: CollectionEntryInput; timestamp: number }
    | { type: 'UPDATE'; entryId: string; payload: Partial<FrontendCollectionEntry>; timestamp: number }
    | { type: 'DELETE'; entryId: string; timestamp: number };

// copies IndexedDB to faster Zustand store
export const useCollectionStore = create<CollectionStoreState>()(
    persist(
        (set, get) => ({
            userId: null,
            entries: [],
            lastSynced: null,
            version: null,
            offline_mutations: [], // Outbox of entry mutations to be synced
            status: 'idle',
            setEntries: (entries) => {
                set({
                    entries: entries,
                    lastSynced: Date.now(),
                    status: 'ready_from_network'
                });
            },

            clearStore: () => {
                set({
                    userId: null,
                    entries: [],
                    lastSynced: null,
                    version: null,
                    status: 'idle'
                });
            },

            // Checks for local cards in Indexeddb and compares to fetched version
            initialize: async (userId: string) => {

                // Checks that cached user matches current user
                const cachedUserId = get().userId;
                if (cachedUserId && cachedUserId !== userId) {
                    //console.log('[CollectionStore]: User mismatch, clearing cache');
                    set({
                        userId,
                        entries: [],
                        lastSynced: null,
                        version: null,
                        status: 'loading'
                    });
                } else {
                    // STALE-WHILE-REVALIDATE LOGIC
                    // If we already have entries from IDB, don't revert to loading.
                    // Just let the background fetch happen silently.
                    if (get().entries.length > 0) {
                        set({ status: 'ready_from_cache' }); 
                    } else if (get().status !== 'loading' && !get().status.startsWith('ready')) {
                        set({ status: 'loading' });
                    }
                }

                try {
                    const result = await trpcClient.collection.getCollection.query({ userId });
                    const { entries: serverEntries, lastModified: serverTimestamp } = result;

                    if (!serverEntries) {
                        throw new Error('No entries in server response');
                    }

                    // Compare server's lastModified with our cached version
                    const cachedTimestamp = get().lastSynced;
                    if (cachedTimestamp && cachedTimestamp >= serverTimestamp) {
                        //console.log('[CollectionStore]: ✅ Cache is up to date');
                        set({ status: 'ready_from_cache' });
                        return;
                    }
                    // console.log(
                    //     `[CollectionStore]: ✅ Loaded ${serverEntries.length} entries from network`
                    // );

                    const mappedEntries: FrontendCollectionEntry[] = serverEntries.map((e) => ({
                        ...e,
                        purchasePrice: Number(e.purchasePrice)
                    }));

                    set({
                        userId,
                        entries: mappedEntries,
                        lastSynced: serverTimestamp,
                        version: `${serverTimestamp}`,
                        status: 'ready_from_network'
                    });
                } catch (error) {
                    //console.error('[CollectionStore]: ❌ Error during initialization:', error);

                    // If we have cached data, use it despite error
                    if (get().entries.length > 0) {
                        //console.log('[CollectionStore]: Using cached data after error');
                        set({ status: 'ready_from_cache' });
                    } else {
                        set({ status: 'error' });
                    }
                }
            },
            addEntry: async (entryInput: CollectionEntryInput) => {
                const { cardId, purchasePrice, variant } = entryInput;
                const previousEntries = get().entries;

                // Create a temporary optimistic entry
                // tempId is both a React key and entryId
                const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const optimisticEntry: FrontendCollectionEntry = {
                    id: tempId,
                    userId: get().userId || 'optimistic-user',
                    cardId,
                    purchasePrice,
                    variant: variant || 'Normal',
                    createdAt: new Date() // Pretend it happened right now
                };

                // Instantly update the store -- The UI will react immediately.
                set((state) => ({
                    entries: [...state.entries, optimisticEntry]
                }));

                const mutationRecord: OfflineMutation = {
                    type: 'ADD',
                    tempId,
                    payload: entryInput,
                    timestamp: Date.now()
                };

                // Check strict offline state
                if (!navigator.onLine) {
                    set((state) => ({
                        offline_mutations: [...state.offline_mutations, mutationRecord]
                    }));
                    return; 
                }

                try {
                    // Fire the actual network request in the background
                    const newEntry = await trpcClient.collection.addToCollection.mutate({
                        cardId: entryInput.cardId,
                        purchasePrice: entryInput.purchasePrice,
                        variant: entryInput.variant || 'Normal'
                    });

                    // Success! - Swap the temporary ID with the real Postgres ID silently
                    set((state) => ({
                        entries: state.entries.map((e) =>
                            // Overrides only the ID and timestamp of the local entry
                            // with that of the DB
                            e.id === tempId
                                ? { ...e, id: newEntry.id, createdAt: newEntry.createdAt }
                                : e
                        ),
                        lastSynced: Date.now()
                    }));
                } catch (error: any) {
                    // Check if tRPC threw a network/connection error
                    const isNetworkError = 
                        error?.data?.code === 'FETCH_ERROR' || 
                        error?.data?.code === 'CLIENT_OFFLINE' ||
                        error?.message?.toLowerCase().includes('fetch') ||
                        error?.message?.toLowerCase().includes('network') ||
                        error?.name === 'TRPCClientError' || // Catch generic dropped connections
                        !navigator.onLine;
                    
                    if (isNetworkError) {
                        // The server couldn't be reached. Save to outbox
                        console.log('[Store] Network error detected. Pushing ADD to Outbox.', mutationRecord);
                        set((state) => ({
                            offline_mutations: [...state.offline_mutations, mutationRecord]
                        }));
                    } else {
                        // The server was reached, but rejected the data (eg 400 Bad Request)
                        toast.error(error.message || 'Server rejected the update.');
                        set({ entries: previousEntries });
                    }
                }
            },

            updateEntry: async (entryId, updates) => {
                const previousEntries = get().entries;
                const cleanUpdates: Partial<FrontendCollectionEntry> = {};
                if (updates.variant) {
                    cleanUpdates.variant = updates.variant;
                }
                if (updates.purchasePrice !== undefined) {
                    cleanUpdates.purchasePrice = Number(updates.purchasePrice);
                }
                if (updates.createdAt) {
                    cleanUpdates.createdAt = updates.createdAt;
                }

                const mutationRecord: OfflineMutation = {
                    type: 'UPDATE',
                    entryId,
                    payload: cleanUpdates,
                    timestamp: Date.now()
                };

                // Optimistic update
                set((state: CollectionStoreState) => ({
                    entries: state.entries.map((e) => {
                        if (e.id === entryId) {
                            return { ...e, ...cleanUpdates } as FrontendCollectionEntry;
                        }
                        return e;
                    })
                }));

                if (!navigator.onLine) {
                    set((state) => ({
                        offline_mutations: [...state.offline_mutations, mutationRecord]
                    }));
                    return;
                }

                try {
                    const { purchasePrice, variant, createdAt } = cleanUpdates;

                    await trpcClient.collection.updateEntry.mutate({
                        entryId,
                        purchasePrice,
                        variant,
                        createdAt
                    });

                    set({ lastSynced: Date.now() });
                } catch (error: any) {
                    // Check if tRPC threw a network/connection error
                    const isNetworkError = 
                        error?.data?.code === 'FETCH_ERROR' || 
                        error?.data?.code === 'CLIENT_OFFLINE' ||
                        error?.message?.toLowerCase().includes('fetch') ||
                        error?.message?.toLowerCase().includes('network') ||
                        error?.name === 'TRPCClientError' || // Catch generic dropped connections
                        !navigator.onLine;

                    if (isNetworkError) {
                        // The server couldn't be reached. Save to outbox
                        set((state) => ({
                            offline_mutations: [...state.offline_mutations, mutationRecord]
                        }));
                    } else {
                        // The server was reached, but rejected the data (eg 400 Bad Request)
                        toast.error(error.message || 'Server rejected the update.');
                        set({ entries: previousEntries });
                    }
                }
            },

            removeEntry: async (entryId) => {
                const previousEntries = get().entries;

                const mutationRecord: OfflineMutation = {
                    type: 'DELETE',
                    entryId,
                    timestamp: Date.now()
                };

                // Remove card marked as 'deleted' from UI
                set((state) => ({
                    entries: state.entries.filter((e) => e.id !== entryId)
                }));

                if (!navigator.onLine) {
                    set((state) => ({
                        offline_mutations: [...state.offline_mutations, mutationRecord]
                    }));
                    return;
                }

                try {
                    await trpcClient.collection.removeFromCollection.mutate({
                        entryId
                    });

                    set({ lastSynced: Date.now() });
                    //console.log('[CollectionStore]: ✅ Entry removed successfully');
                } catch (error: any) {
                    // Check if tRPC threw a network/connection error
                    const isNetworkError = 
                        error?.data?.code === 'FETCH_ERROR' || 
                        error?.data?.code === 'CLIENT_OFFLINE' ||
                        error?.message?.toLowerCase().includes('fetch') ||
                        error?.message?.toLowerCase().includes('network') ||
                        error?.name === 'TRPCClientError' || // Catch generic dropped connections
                        !navigator.onLine;

                    if (isNetworkError) {
                        // The server couldn't be reached. Save to outbox
                        set((state) => ({
                            offline_mutations: [...state.offline_mutations, mutationRecord]
                        }));
                    } else {
                        // The server was reached, but rejected the data (eg 400 Bad Request)
                        toast.error(error.message || 'Server rejected the update.');
                        set({ entries: previousEntries });
                    }
                }
            },
            // Loops through offline mutations list when called by OfflineProvider when network switches to online
            // Runs the TRPC function for each offline-queued mutation
            processQueue: async () => {
                const { offline_mutations, entries } = get();

                //console.log(`[Sync Engine] processQueue triggered. Items in Outbox: ${offline_mutations.length}`);
                if (offline_mutations.length === 0) return;

                // Track temp IDs mapped to real Database IDs as they are created
                const idMap = new Map<string, string>();
                
                // Clone state so we can mutate safely inside the loop
                let currentMutations = [...offline_mutations];
                let currentEntries = [...entries];

                // Process sequentially to maintain strict chronological order
                while (currentMutations.length > 0) {
                    const mutation = currentMutations[0];
                    // console.log(`[Sync Engine] Attempting ${mutation.type} mutation...`, mutation);

                    try {
                        if (mutation.type === 'ADD') {
                            const result = await trpcClient.collection.addToCollection.mutate({...mutation.payload, variant: mutation.payload.variant || 'Normal'});
                            idMap.set(mutation.tempId, result.id);
                            
                            // Swap tempId for real DB ID in local state
                            currentEntries = currentEntries.map((e) => 
                                e.id === mutation.tempId ? { ...e, id: result.id, createdAt: result.createdAt } : e
                            );
                        } 
                        else if (mutation.type === 'UPDATE') {
                            // If this was added offline, use the new real ID. Otherwise, use existing ID.
                            const targetId = idMap.get(mutation.entryId) || mutation.entryId;
                            await trpcClient.collection.updateEntry.mutate({ 
                                entryId: targetId, 
                                ...mutation.payload 
                            });
                        } 
                        else if (mutation.type === 'DELETE') {
                            const targetId = idMap.get(mutation.entryId) || mutation.entryId;
                            await trpcClient.collection.removeFromCollection.mutate({ entryId: targetId });
                        }

                        // Success: Remove from queue and update store
                        // console.log(`[Sync Engine] ${mutation.type} Success! Removing from queue.`);
                        currentMutations.shift();
                        set({ offline_mutations: currentMutations, entries: currentEntries });

                    } catch (error: any) {
                        const isNetworkError = error?.data?.code === 'FETCH_ERROR' || error?.data?.code === 'CLIENT_OFFLINE' || error?.message?.includes('fetch') || !navigator.onLine;

                        if (isNetworkError) {
                            // Stop processing the queue immediately. We will try again later.
                            // console.warn('[CollectionStore] Network dropped while flushing queue. Pausing.');
                            break; 
                        } else {
                            // Server rejected it with a logic error (400 Bad Request). 
                            // If we don't drop it, it will block the queue forever.
                            // console.error('[CollectionStore] Logic error flushing mutation, dropping it from queue:', mutation);
                            currentMutations.shift();
                            set({ offline_mutations: currentMutations });
                        }
                    }
                }

                // If we cleared the queue completely, update our sync timestamp
                if (get().offline_mutations.length === 0) {
                    // console.log('[Sync Engine] All offline mutations synced successfully!');
                    set({ lastSynced: Date.now() });
                }
            }
        }),
        {
            name: 'collection-data-storage',
            storage: indexedDbStorage,
            partialize: (state): PersistedState => ({
                userId: state.userId,
                entries: state.entries,
                lastSynced: state.lastSynced,
                version: state.version,
                offline_mutations: state.offline_mutations
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    //console.log('[CollectionStore]: Rehydrated from IndexedDB');
                    if (state.entries && state.entries.length > 0) {
                        useCollectionStore.setState({ status: 'ready_from_cache' });
                    }

                    // If we wake up and have offline mutations waiting...
                    if (state.offline_mutations && state.offline_mutations.length > 0) {
                        // console.log(`[Store] Woke up with ${state.offline_mutations.length} unsent mutations in IDB.`);
                        if (navigator.onLine) {
                            // Wait 1.5s for DNS/Routers to stabilize, then flush
                            setTimeout(() => {
                                // console.log('[Store] Network looks online. Triggering rehydration flush...');
                                useCollectionStore.getState().processQueue();
                            }, 1500);
                        }
                    }
                }
            }
        }
    )
);
