import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core";
import { createScene } from "../scenes/createScene";

export default function BabylonCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new Engine(canvas, true);
        const scene = createScene(engine, canvas);

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