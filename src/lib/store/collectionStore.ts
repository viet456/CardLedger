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
    updateEntry: (entryId: string, updates: Partial<CollectionEntry>) => Promise<void>;
    removeEntry: (entryId: string) => Promise<void>;
    setEntries: (entries: FrontendCollectionEntry[]) => void;
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

// copies IndexedDB to faster Zustand store
export const useCollectionStore = create<CollectionStoreState>()(
    persist(
        (set, get) => ({
            userId: null,
            entries: [],
            lastSynced: null,
            version: null,
            status: 'idle',
            setEntries: (entries) => {
                set({ 
                    entries: entries,
                    lastSynced: Date.now(),
                    status: 'ready_from_network'
                });
            },

            // Checks for local cards in Indexeddb and compares to fetched version
            initialize: async (userId: string) => {
                if (get().status.startsWith('loading') || get().status.startsWith('ready')) {
                    return;
                }

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
                    set({ status: 'loading' });
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

                    const mappedEntries: FrontendCollectionEntry[] = serverEntries.map(e => ({
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
            addEntry: async (entry) => {
                const tempId = `temp-${Date.now()}`;
                const currentUserId = get().userId;
                if (!currentUserId) {
                    throw new Error('Cannot add entry: user not initialized');
                }
                const optimisticEntry: FrontendCollectionEntry = {
                    id: tempId,
                    userId: currentUserId,
                    createdAt: new Date(),
                    cardId: entry.cardId,
                    purchasePrice: entry.purchasePrice, 
                    variant: entry.variant || 'Normal',
                };

                // Optimistic update
                set((state) => ({
                    entries: [optimisticEntry, ...state.entries]
                }));

                try {
                    const newEntry = await trpcClient.collection.addToCollection.mutate({
                        cardId: entry.cardId,
                        purchasePrice: entry.purchasePrice, 
                        variant: entry.variant || 'Normal'
                    });
                    
                    const mappedNewEntry: FrontendCollectionEntry = {
                        ...newEntry,
                        purchasePrice: Number(newEntry.purchasePrice)
                    };

                    // Replace temp(ui) entry with real entry from server
                    set((state) => ({
                        entries: state.entries.map((e) => (e.id === tempId ? mappedNewEntry : e)),
                        lastSynced: Date.now()
                    }));
                    //console.log('[CollectionStore]: ✅ Entry added successfully');
                } catch (error) {
                    // Rollback
                    //console.error('[CollectionStore]: ❌ Failed to add entry:', error);
                    set((state) => ({
                        entries: state.entries.filter((e) => e.id !== tempId)
                    }));
                    throw error;
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

                // Optimistic update
                set((state: CollectionStoreState) => ({
                    entries: state.entries.map((e) => {
                        if (e.id === entryId) {
                            return { ...e, ...cleanUpdates } as FrontendCollectionEntry;
                        }
                        return e;
                    })
                }));

                try {
                    const { purchasePrice, variant, createdAt } = cleanUpdates;

                    await trpcClient.collection.updateEntry.mutate({
                        entryId,
                        purchasePrice,
                        variant,
                        createdAt
                    });

                    set({ lastSynced: Date.now() });
                } catch (error) {
                    toast.error('Failed to update entry');
                    set({ entries: previousEntries });
                    throw error;
                }
            },

            removeEntry: async (entryId) => {
                const previousEntries = get().entries;

                // Optimistic update
                set((state) => ({
                    entries: state.entries.filter((e) => e.id !== entryId)
                }));

                try {
                    await trpcClient.collection.removeFromCollection.mutate({
                        entryId
                    });

                    set({ lastSynced: Date.now() });
                    //console.log('[CollectionStore]: ✅ Entry removed successfully');
                } catch (error) {
                    // Rollback
                    //console.error('[CollectionStore]: ❌ Failed to remove entry:', error);
                    set({ entries: previousEntries });
                    throw error;
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
                version: state.version
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    //console.log('[CollectionStore]: Rehydrated from IndexedDB');
                    if (state.entries && state.entries.length > 0) {
                        useCollectionStore.setState({ status: 'ready_from_cache' });
                    }
                }
            }
        }
    )
);
