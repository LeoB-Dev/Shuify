import { create } from "zustand";
import { persist } from "zustand/middleware";

const useSceneStore = create(
    persist(
        (set, get) => ({
            draggingItem: null,
            setDraggingItem: (item) => set({ draggingItem: item }),
            clearDraggingItem: () => set({ draggingItem: null }),

            placedItems: [],
            addPlacedItem: (item) => set((state) => {
                const next = [...state.placedItems, item];
                return { placedItems: next };
            }),
            updateItem: (uid, patch) => set((state) => {
                const next = state.placedItems.map((i) => i.uid === uid ? { ...i, ...patch } : i);
                return { placedItems: next };
            }),
            removeItem: (uid) => set((state) => ({
                placedItems: state.placedItems.filter((i) => i.uid !== uid),
            })),
            clearPlacedItems: () => set({ placedItems: [] }),

            // pendingDeleteUid is set by the Sidebar and consumed by App.jsx to dispose the mesh.
            pendingDeleteUid: null,
            requestItemDelete: (uid) => set({ pendingDeleteUid: uid }),
            clearPendingDelete: () => set({ pendingDeleteUid: null }),

            // ── Saved rooms ──────────────────────────────────────────────────────
            rooms: [],

            saveRoom: (name) => set((state) => {
                const room = {
                    id: Date.now(),
                    name,
                    createdAt: new Date().toISOString(),
                    items: state.placedItems.map((i) => ({ ...i })),
                };
                return { rooms: [...state.rooms, room] };
            }),

            deleteRoom: (roomId) => set((state) => ({
                rooms: state.rooms.filter((r) => r.id !== roomId),
                activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId,
            })),

            renameRoom: (roomId, name) => set((state) => ({
                rooms: state.rooms.map((r) => r.id === roomId ? { ...r, name } : r),
            })),

            // Overwrite a saved room's items with the current placedItems snapshot.
            updateRoom: (roomId) => set((state) => ({
                rooms: state.rooms.map((r) =>
                    r.id === roomId
                        ? { ...r, items: state.placedItems.map((i) => ({ ...i })) }
                        : r
                ),
            })),

            // Tracks which saved room is currently loaded so the footer can offer "Update".
            activeRoomId: null,

            // pendingLoad is set by loadRoom and consumed by App.jsx to re-spawn meshes.
            // It is NOT persisted — it's a session-only signal.
            pendingLoad: null,

            loadRoom: (roomId) => {
                const room = get().rooms.find((r) => r.id === roomId);
                if (!room) return;
                set({ pendingLoad: room.items.map((i) => ({ ...i })), activeRoomId: roomId });
            },

            clearPendingLoad: () => set({ pendingLoad: null }),
        }),
        {
            name: "shuify-rooms",
            // Only persist the saved rooms list — all other state is session-only.
            partialize: (state) => ({ rooms: state.rooms }),
        }
    )
);

export default useSceneStore;
