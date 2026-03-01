import { create } from "zustand";

const useSceneStore = create((set) => ({
    draggingItem: null,
    setDraggingItem: (item) => set({ draggingItem: item }),
    clearDraggingItem: () => set({ draggingItem: null }),

    placedItems: [],
    addPlacedItem: (item) => set((state) => ({ placedItems: [...state.placedItems, item] })),
    updateItemPosition: (uid, x, z) => set((state) => ({
        placedItems: state.placedItems.map((i) => i.uid === uid ? { ...i, x, z } : i),
    })),
}));

export default useSceneStore;