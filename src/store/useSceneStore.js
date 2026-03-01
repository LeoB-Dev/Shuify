import { create } from "zustand";

const useSceneStore = create((set) => ({
    draggingItem: null,
    setDraggingItem: (item) => set({ draggingItem: item }),
    clearDraggingItem: () => set({ draggingItem: null }),

    placedItems: [],
    addPlacedItem: (item) => set((state) => {
        const next = [...state.placedItems, item];
        console.log("[room] placed:", item, "| all items:", next);
        return { placedItems: next };
    }),
    // Merges any fields into the matching placed item — used to update position, wall, y, etc.
    updateItem: (uid, patch) => set((state) => {
        const next = state.placedItems.map((i) => i.uid === uid ? { ...i, ...patch } : i);
        console.log("[room] updated:", next.find((i) => i.uid === uid), "| all items:", next);
        return { placedItems: next };
    }),
}));

export default useSceneStore;
