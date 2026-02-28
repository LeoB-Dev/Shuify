import { create } from "zustand";

const useSceneStore = create((set) => ({
    draggingItem: null,
    setDraggingItem: (item) => set({ draggingItem: item }),
    clearDraggingItem: () => set({ draggingItem: null }),
}));

export default useSceneStore;