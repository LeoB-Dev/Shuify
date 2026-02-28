import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core";
import { createScene } from "../scenes/createScene";

export default function BabylonCanvas({ onSceneReady }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true);
        const scene = createScene(engine, canvas);

        if (onSceneReady) onSceneReady(scene);

        engine.runRenderLoop(() => {
            scene.render();
        });

        const resize = () => engine.resize();
        window.addEventListener("resize", resize);

        return () => {
            window.removeEventListener("resize", resize);
            engine.dispose();
        };
    }, []);

    return <canvas ref={canvasRef} className="w-full h-full block" />;
}