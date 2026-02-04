import { create } from 'zustand';

interface ScrollStore {
    scrollIndex: number;
    setScrollIndex: (index: number) => void;
}

export const useScrollStore = create<ScrollStore>((set) => ({
    scrollIndex: 0,
    setScrollIndex: (index) => set({ scrollIndex: index })
}));
