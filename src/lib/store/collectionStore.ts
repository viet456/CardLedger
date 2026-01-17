import { create } from 'zustand/react';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { CollectionEntry } from '@prisma/client';
import { trpcClient } from '@/src/utils/trpc';

type PersistedState = {
    userId: string | null;
    entries: CollectionEntry[];
    lastSynced: number | null; // Timestamp from server
    version: string | null; // Hash or timestamp
};

export type CollectionStoreState = PersistedState & {
    status: 'idle' | 'loading' | 'ready_from_cache' | 'ready_from_network' | 'error';
    initialize: (userId: string) => Promise<void>;
    addEntry: (entry: Omit<CollectionEntry, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
    updateEntry: (entryId: string, updates: Partial<CollectionEntry>) => Promise<void>;
    removeEntry: (entryId: string) => Promise<void>;
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

            // Checks for local cards in Indexeddb and compares to fetched version
            initialize: async (userId: string) => {
                if (get().status.startsWith('loading') || get().status.startsWith('ready')) {
                    return;
                }

                // Checks that cached user matches current user
                const cachedUserId = get().userId;
                if (cachedUserId && cachedUserId !== userId) {
                    console.log('[CollectionStore]: User mismatch, clearing cache');
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
                        console.log('[CollectionStore]: ✅ Cache is up to date');
                        set({ status: 'ready_from_cache' });
                        return;
                    }
                    console.log(
                        `[CollectionStore]: ✅ Loaded ${serverEntries.length} entries from network`
                    );

                    set({
                        userId,
                        entries: serverEntries,
                        lastSynced: serverTimestamp,
                        version: `${serverTimestamp}`,
                        status: 'ready_from_network'
                    });
                } catch (error) {
                    console.error('[CollectionStore]: ❌ Error during initialization:', error);

                    // If we have cached data, use it despite error
                    if (get().entries.length > 0) {
                        console.log('[CollectionStore]: Using cached data after error');
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
                const optimisticEntry = {
                    ...entry,
                    id: tempId,
                    createdAt: new Date(),
                    userId: currentUserId,
                    variantName: entry.variantName ?? null
                };

                // Optimistic update
                set((state) => ({
                    entries: [optimisticEntry, ...state.entries]
                }));

                try {
                    const newEntry = await trpcClient.collection.addToCollection.mutate({
                        cardId: entry.cardId,
                        purchasePrice: entry.purchasePrice,
                        condition: entry.condition
                    });

                    // Replace temp(ui) entry with real entry from server
                    set((state) => ({
                        entries: state.entries.map((e) => (e.id === tempId ? newEntry : e)),
                        lastSynced: Date.now()
                    }));
                    console.log('[CollectionStore]: ✅ Entry added successfully');
                } catch (error) {
                    // Rollback
                    console.error('[CollectionStore]: ❌ Failed to add entry:', error);
                    set((state) => ({
                        entries: state.entries.filter((e) => e.id !== tempId)
                    }));
                    throw error;
                }
            },

            updateEntry: async (entryId, updates) => {
                const previousEntries = get().entries;

                // Optimistic update
                set((state) => ({
                    entries: state.entries.map((e) => (e.id === entryId ? { ...e, ...updates } : e))
                }));

                try {
                    await trpcClient.collection.updateEntry.mutate({
                        entryId,
                        ...updates
                    });

                    console.log('[CollectionStore]: ✅ Entry updated successfully');
                    set({ lastSynced: Date.now() });
                } catch (error) {
                    // Rollback
                    console.error('[CollectionStore]: ❌ Failed to update entry:', error);
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
                    console.log('[CollectionStore]: ✅ Entry removed successfully');
                } catch (error) {
                    // Rollback
                    console.error('[CollectionStore]: ❌ Failed to remove entry:', error);
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
                    console.log('[CollectionStore]: Rehydrated from IndexedDB');
                    if (state.entries && state.entries.length > 0) {
                        useCollectionStore.setState({ status: 'ready_from_cache' });
                    }
                }
            }
        }
    )
);
