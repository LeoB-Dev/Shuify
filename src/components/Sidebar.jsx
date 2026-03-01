import {
    LayoutGrid,
    AlignVerticalJustifyStart,
    RectangleHorizontal,
    Square,
    Rows3,
    Monitor,
} from "lucide-react";
import useSceneStore from "../store/useSceneStore";

const FURNITURE_ITEMS = [
    {
        id: "base-cabinet",
        label: "Base Cabinet",
        description: "Standard floor unit",
        icon: RectangleHorizontal,
        dimensions: { width: 2, height: 1, depth: 0.5 },
    },
    {
        id: "wall-cabinet",
        label: "Wall Cabinet",
        description: "Mounted wall unit",
        icon: AlignVerticalJustifyStart,
        dimensions: { width: 1.5, height: 0.8, depth: 0.3 },
    },
    {
        id: "tall-cabinet",
        label: "Tall Cabinet",
        description: "Full height storage",
        icon: Square,
        dimensions: { width: 1, height: 2.5, depth: 0.5 },
    },
    {
        id: "island",
        label: "Island",
        description: "Centre kitchen island",
        icon: LayoutGrid,
        dimensions: { width: 3, height: 1, depth: 1.5 },
    },
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
];

function FurnitureButton({ item, mobile = false }) {
    const setDraggingItem = useSceneStore((s) => s.setDraggingItem);
    const clearDraggingItem = useSceneStore((s) => s.clearDraggingItem);
    const Icon = item.icon;

    const dragProps = {
        draggable: true,
        onDragStart: () => setDraggingItem(item),
        onDragEnd: () => clearDraggingItem(),
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

export default function Sidebar() {
    const placedItems = useSceneStore((s) => s.placedItems);

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
                                        <div key={item.uid} className="px-3 py-2 rounded-lg">
                                            <p className="text-sm text-[#aaa] font-medium">{item.label}</p>
                                            <p className="text-[11px] text-[#555] mt-0.5">
                                                x: {item.x.toFixed(2)}m &nbsp; z: {item.z.toFixed(2)}m
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="px-5 py-4 border-t border-[#2e2e2e]">
                        <p className="text-[10px] text-[#444]">Drag items into the room</p>
                    </div>
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