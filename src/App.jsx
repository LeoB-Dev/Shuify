import { useRef } from "react";
import BabylonCanvas from "./components/BabylonCanvas";
import Sidebar from "./components/Sidebar";
import useSceneStore from "./store/useSceneStore";
import { MeshBuilder, PointerDragBehavior, Vector3 } from "@babylonjs/core";

export default function App() {
  const sceneRef = useRef(null);
  const draggingItemRef = useRef(null);
  const draggingItem = useSceneStore((s) => s.draggingItem);

  // keep ref in sync with store
  draggingItemRef.current = draggingItem;

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const scene = sceneRef.current;
    const item = draggingItemRef.current;
    if (!scene || !item) return;

    const canvas = scene.getEngine().getRenderingCanvas();
    const rect = canvas.getBoundingClientRect();
    console.log("rect left:", rect.left, "rect top:", rect.top);

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pickResult = scene.pick(x, y);
    if (!pickResult.hit) return;

    const { x: px, z: pz } = pickResult.pickedPoint;
    const { width, height, depth } = item.dimensions;

    const mesh = MeshBuilder.CreateBox(item.id, { width, height, depth }, scene);
    mesh.position.x = px;
    mesh.position.y = height / 2;
    mesh.position.z = pz;

    const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    mesh.addBehavior(dragBehavior);
  };

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <Sidebar />
      <div
        className="absolute top-0 right-0 bottom-44 left-0 md:bottom-0 md:left-64"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <BabylonCanvas onSceneReady={(scene) => (sceneRef.current = scene)} />
      </div>
      {draggingItem && (
        <div className="absolute top-4 right-4 bg-white text-black text-xs px-3 py-2 rounded z-50">
          Dragging: {draggingItem.label}
        </div>
      )}
    </div>
  );
}