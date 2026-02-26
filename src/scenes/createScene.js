import {
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    MeshBuilder,
    StandardMaterial,
    Color3,
} from "@babylonjs/core";

import { GridMaterial } from "@babylonjs/materials";

export function createScene(engine, canvas) {
    const scene = new Scene(engine); // all vars below are passed into scene

    const camera = new ArcRotateCamera(
        "camera",
        Math.PI / 2,
        Math.PI / 2.5,
        32, // initial distance from camera
        Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);
    camera.upperBetaLimit = 1.50; // higher for lower limit
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 130;


    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // THIS IS THE PLANE (flat ground)
    const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 10, height: 10 },
        scene
    );

    const groundMaterial = new GridMaterial("groundMaterial", scene);
    groundMaterial.majorUnitFrequency = 0;  // thick line every 5 units
    groundMaterial.minorUnitVisibility = 0.5;  // how visible minor lines are
    groundMaterial.gridRatio = 1;  // size of each grid square
    groundMaterial.mainColor = new Color3(0.98, 0.98, 0.95);  // linear RGB
    groundMaterial.lineColor = new Color3(0.58, 0.61, 0.61);
    ground.material = groundMaterial;

    const wallBack = MeshBuilder.CreateBox("wallBack", { width: 10, height: 5, depth: 0.1 }, scene);
    wallBack.position = new Vector3(0, 2.5, -5);

    const wallFront = MeshBuilder.CreateBox("wallFront", { width: 10, height: 5, depth: 0.1 }, scene);
    wallFront.position = new Vector3(0, 2.5, 5);
    wallFront.visibility = 0;

    const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: 0.1, height: 5, depth: 10 }, scene);
    wallLeft.position = new Vector3(-5, 2.5, 0);

    const wallRight = MeshBuilder.CreateBox("wallRight", { width: 0.1, height: 5, depth: 10 }, scene);
    wallRight.position = new Vector3(5, 2.5, 0);

    // THIS IS THE CUBE
    const box = MeshBuilder.CreateBox("box", { size: 1 }, scene);
    box.position.y = 0.5; // lifts it so it sits ON the ground rather than inside it
    const boxMaterial = new StandardMaterial("boxMaterial", scene);
    boxMaterial.diffuseColor = new Color3(1, 0, 0); // red
    box.material = boxMaterial;

    return scene;
}