import { useState, useRef } from "react";
import {
    Rows3,
    Monitor,
    BedDouble,
    Laptop,
    Armchair,
    Sofa,
    AppWindow,
    DoorOpen,
    Package,
    Save,
    FolderOpen,
    Trash2,
    ChevronDown,
    ChevronRight,
    Pencil,
    RefreshCw,
} from "lucide-react";
import useSceneStore from "../store/useSceneStore";

const FURNITURE_ITEMS = [
    {
        id: "shelf",
        label: "Shelf",
        description: "Open wall shelf",
        icon: Rows3,
        dimensions: { width: 2, height: 0.2, depth: 0.3 },
    },
    {
        id: "tv",
        label: "TV",
        description: "Wall mounted screen",
        icon: Monitor,
        mountType: "wall",
        dimensions: { width: 1.6, height: 0.9, depth: 0.05 },
    },
    {
        id: "desk",
        label: "Desk",
        description: "Writing desk with drawers",
        icon: Laptop,
        dimensions: { width: 2.2, height: 0.76, depth: 1.0 },
    },
    {
        id: "chair",
        label: "Chair",
        description: "Desk chair with cushion",
        icon: Armchair,
        dimensions: { width: 0.58, height: 0.88, depth: 0.55 },
    },
    {
        id: "eames-chair",
        label: "Eames Chair",
        description: "Classic lounge chair",
        icon: Armchair,
        dimensions: { width: 1.63, height: 1.72, depth: 1.63 },
        glbRotation: [0, -Math.PI / 2, 0],
    },
    {
        id: "tripo-sofa",
        label: "Couch",
        description: "3-seater fabric sofa",
        icon: Sofa,
        dimensions: { width: 3.65, height: 1.64, depth: 1.64 },
        glbRotation: [0, -Math.PI / 2, 0],
    },
    {
        id: "window",
        label: "Window",
        description: "Wall mounted window",
        icon: AppWindow,
        mountType: "wall",
        dimensions: { width: 1.4, height: 1.2, depth: 0.12 },
    },
    {
        id: "door",
        label: "Door",
        description: "Room door with frame",
        icon: DoorOpen,
        mountType: "wall",
        dimensions: { width: 1.4, height: 3.2, depth: 0.12 },
    },
    {
        id: "woodenbed",
        label: "Wooden Bed",
        description: "Wooden bed frame",
        icon: BedDouble,
        dimensions: { width: 2.56, height: 1.312, depth: 3.2 },
        glbRotation: [0, -Math.PI / 2, 0],
    },
];

function FurnitureButton({ item, mobile = false }) {
    const setDraggingItem = useSceneStore((s) => s.setDraggingItem);
    const clearDraggingItem = useSceneStore((s) => s.clearDraggingItem);
    const Icon = item.icon;

    const dragProps = {
        draggable: true,
        onDragStart: () => setDraggingItem(item),
        onDragEnd: () => clearDraggingItem(),
        // Touch support: touchstart sets the active item; touchmove/touchend are
        // handled globally in App.jsx so the finger can travel onto the canvas.
        onTouchStart: (e) => {
            e.preventDefault(); // prevent tap-highlight / scroll-start on the button
            setDraggingItem(item);
        },
    };

    if (mobile) {
        return (
            <button
                {...dragProps}
                className="flex flex-col items-center gap-2 py-3 rounded-lg text-[#aaa] hover:text-white hover:bg-[#252525] cursor-grab active:cursor-grabbing"
            >
                <div className="w-8 h-8 rounded-md bg-[#252525] flex items-center justify-center">
                    <Icon size={15} className="text-[#888]" />
                </div>
                <p className="text-[10px] font-medium text-center leading-tight">{item.label}</p>
            </button>
        );
    }

    return (
        <button
            {...dragProps}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[#aaa] hover:text-white hover:bg-[#252525] cursor-grab active:cursor-grabbing"
        >
            <div className="w-8 h-8 rounded-md bg-[#252525] flex items-center justify-center shrink-0">
                <Icon size={15} className="text-[#888]" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium leading-none truncate">{item.label}</p>
                <p className="text-[11px] text-[#555] mt-1 truncate">{item.description}</p>
            </div>
        </button>
    );
}

function SaveRoomFooter() {
    const placedItems = useSceneStore((s) => s.placedItems);
    const saveRoom    = useSceneStore((s) => s.saveRoom);
    const updateRoom  = useSceneStore((s) => s.updateRoom);
    const activeRoomId = useSceneStore((s) => s.activeRoomId);
    const rooms       = useSceneStore((s) => s.rooms);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [flash, setFlash] = useState(null); // "saved" | "updated"

    const canSave   = placedItems.length > 0;
    const activeRoom = rooms.find((r) => r.id === activeRoomId);

    const showFlash = (type) => {
        setFlash(type);
        setTimeout(() => setFlash(null), 2000);
    };

    const handleSaveNew = () => {
        const trimmed = name.trim() || "My Room";
        saveRoom(trimmed);
        setName("");
        setSaving(false);
        showFlash("saved");
    };

    const handleUpdate = () => {
        updateRoom(activeRoomId);
        showFlash("updated");
    };

    if (saving) {
        return (
            <div className="px-5 py-4 border-t border-[#2e2e2e] flex flex-col gap-2">
                <input
                    autoFocus
                    type="text"
                    placeholder="Room name…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveNew();
                        if (e.key === "Escape") { setSaving(false); setName(""); }
                    }}
                    className="w-full bg-[#252525] text-white text-sm rounded-md px-3 py-1.5 outline-none border border-[#3a3a3a] focus:border-[#555] placeholder-[#555]"
                />
                <div className="flex gap-2">
                    <button onClick={handleSaveNew} className="flex-1 bg-white text-black text-xs font-semibold rounded-md py-1.5 hover:bg-[#ddd]">
                        Save
                    </button>
                    <button onClick={() => { setSaving(false); setName(""); }} className="flex-1 bg-[#252525] text-[#aaa] text-xs font-semibold rounded-md py-1.5 hover:bg-[#2e2e2e]">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="px-5 py-4 border-t border-[#2e2e2e] flex flex-col gap-2">
            <p className="text-[10px] text-[#444]">Drag to place &nbsp;·&nbsp; Right-click to rotate</p>
            {canSave && (
                <div className="flex items-center gap-2">
                    {flash ? (
                        <span className="text-[10px] text-green-500 font-medium">
                            {flash === "updated" ? `Updated "${activeRoom?.name}"` : "Saved!"}
                        </span>
                    ) : (
                        <>
                            {activeRoom && (
                                <button
                                    onClick={handleUpdate}
                                    title={`Overwrite "${activeRoom.name}"`}
                                    className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors"
                                >
                                    <RefreshCw size={11} />
                                    <span>Update</span>
                                </button>
                            )}
                            <button
                                onClick={() => setSaving(true)}
                                title="Save as new room"
                                className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors ml-auto"
                            >
                                <Save size={11} />
                                <span>Save new</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function RoomRow({ room, onLoad, loadingId }) {
    const renameRoom = useSceneStore((s) => s.renameRoom);
    const deleteRoom = useSceneStore((s) => s.deleteRoom);
    const activeRoomId = useSceneStore((s) => s.activeRoomId);
    const [renaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState(room.name);
    const inputRef = useRef(null);

    const commitRename = () => {
        const trimmed = draftName.trim();
        if (trimmed) renameRoom(room.id, trimmed);
        else setDraftName(room.name);
        setRenaming(false);
    };

    const startRename = () => {
        setDraftName(room.name);
        setRenaming(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const isActive = activeRoomId === room.id;
    const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return (
        <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[#252525] group ${isActive ? "bg-[#222]" : ""}`}>
            <div className="flex-1 min-w-0">
                {renaming ? (
                    <input
                        ref={inputRef}
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") { setDraftName(room.name); setRenaming(false); }
                        }}
                        className="w-full bg-[#333] text-white text-sm rounded px-1.5 py-0.5 outline-none border border-[#555]"
                    />
                ) : (
                    <p className="text-sm text-[#aaa] font-medium truncate">
                        {room.name}
                        {isActive && <span className="ml-1.5 text-[9px] text-[#555] uppercase tracking-wider">active</span>}
                    </p>
                )}
                <p className="text-[10px] text-[#444]">
                    {fmt(room.createdAt)} &nbsp;·&nbsp; {room.items.length} item{room.items.length !== 1 ? "s" : ""}
                </p>
            </div>
            <button onClick={startRename} title="Rename" className="shrink-0 p-1 text-[#555] hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                <Pencil size={11} />
            </button>
            <button onClick={() => onLoad(room.id)} title="Load room" className="shrink-0 p-1 text-[#555] hover:text-white transition-colors">
                {loadingId === room.id
                    ? <span className="text-[10px] text-green-500">✓</span>
                    : <FolderOpen size={13} />
                }
            </button>
            <button onClick={() => deleteRoom(room.id)} title="Delete room" className="shrink-0 p-1 text-[#555] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={13} />
            </button>
        </div>
    );
}

function MyRooms() {
    const rooms = useSceneStore((s) => s.rooms);
    const loadRoom = useSceneStore((s) => s.loadRoom);
    const [open, setOpen] = useState(false);
    const [loadingId, setLoadingId] = useState(null);

    if (rooms.length === 0) return null;

    const handleLoad = (id) => {
        setLoadingId(id);
        loadRoom(id);
        setTimeout(() => setLoadingId(null), 800);
    };

    return (
        <div className="mt-5">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-2 mb-1 text-[#555] hover:text-[#888] transition-colors"
            >
                <p className="text-[10px] uppercase tracking-[0.2em] font-medium">My Rooms</p>
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
            {open && (
                <div className="flex flex-col gap-0.5">
                    {rooms.map((room) => (
                        <RoomRow key={room.id} room={room} onLoad={handleLoad} loadingId={loadingId} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Sidebar() {
    const placedItems = useSceneStore((s) => s.placedItems);
    const requestItemDelete = useSceneStore((s) => s.requestItemDelete);

    return (
        <>
            {/* Desktop */}
            <aside className="hidden md:block absolute left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-[#2e2e2e] z-10">
                <div className="flex flex-col h-full">
                    <div className="px-5 pt-6 pb-4 border-b border-[#2e2e2e]">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#666] font-medium">Room Planner</p>
                        <h1 className="text-white text-xl font-semibold mt-0.5 tracking-tight">Shuify</h1>
                    </div>
                    <div className="flex-1 overflow-y-auto px-3 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-medium px-2 mb-2">
                            Furniture
                        </p>
                        <div className="flex flex-col gap-0.5">
                            {FURNITURE_ITEMS.map((item) => (
                                <FurnitureButton key={item.id} item={item} />
                            ))}
                        </div>
                        {placedItems.length > 0 && (
                            <div className="mt-5">
                                <p className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-medium px-2 mb-2">
                                    Placed Items
                                </p>
                                <div className="flex flex-col gap-0.5">
                                    {placedItems.map((item) => (
                                        <div key={item.uid} className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-[#252525] group">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-[#aaa] font-medium truncate">{item.label}</p>
                                                <p className="text-[11px] text-[#555] mt-0.5">
                                                    x: {item.x.toFixed(2)}m &nbsp; z: {item.z.toFixed(2)}m
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => requestItemDelete(item.uid)}
                                                title="Remove item"
                                                className="shrink-0 p-1 text-[#555] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <MyRooms />
                    </div>
                    <SaveRoomFooter />
                </div>
            </aside>

            {/* Mobile */}
            <aside className="md:hidden absolute bottom-0 left-0 right-0 h-44 bg-[#1a1a1a] border-t border-[#2e2e2e] z-10">
                <div className="px-3 pt-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-medium px-2 mb-2">
                        Furniture
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                        {FURNITURE_ITEMS.map((item) => (
                            <FurnitureButton key={item.id} item={item} mobile />
                        ))}
                    </div>
                </div>
            </aside>
        </>
    );
}
