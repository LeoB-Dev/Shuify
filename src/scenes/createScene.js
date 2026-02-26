import {
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    MeshBuilder,
    StandardMaterial,
    Color3,
    PointerDragBehavior,
} from "@babylonjs/core";

import { GridMaterial } from "@babylonjs/materials";

export function createScene(engine, canvas) {
    const scene = new Scene(engine); // all vars below are passed into scene

    // --- CAMERA ---
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
    camera.lowerRadiusLimit = 5;  // prevents zooming in too close
    camera.upperRadiusLimit = 130; // prevents zooming out too far

    // --- LIGHT ---
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // --- GROUND ---
    const ground = MeshBuilder.CreateGround(
        "ground",
        { width: 10, height: 10 },
        scene
    );
    const groundMaterial = new GridMaterial("groundMaterial", scene);
    groundMaterial.majorUnitFrequency = 0;    // disables major (thick) grid lines
    groundMaterial.minorUnitVisibility = 0.5; // opacity of minor grid lines
    groundMaterial.gridRatio = 1;             // size of each grid square in units
    groundMaterial.mainColor = new Color3(0.98, 0.98, 0.95); // ground base colour
    groundMaterial.lineColor = new Color3(0.58, 0.61, 0.61); // grid line colour
    ground.material = groundMaterial;

    // --- WALLS ---
    const wallMaterial = new StandardMaterial("wallMaterial", scene);
    wallMaterial.diffuseColor = new Color3(0.95, 0.93, 0.88); // warm off-white plaster

    const wallGridMaterial = new GridMaterial("wallGridMaterial", scene);
    wallGridMaterial.majorUnitFrequency = 0;    // disables major (thick) grid lines
    wallGridMaterial.minorUnitVisibility = 0.5; // opacity of minor grid lines
    wallGridMaterial.gridRatio = 1;             // size of each grid square in units
    wallGridMaterial.mainColor = new Color3(0.95, 0.93, 0.88); // matches wall colour
    wallGridMaterial.lineColor = new Color3(0.58, 0.61, 0.61); // grid line colour

    // back wall (outside: solid, inside: grid — using grid for now on both sides)
    const wallBack = MeshBuilder.CreateBox("wallBack", { width: 10, height: 5, depth: 0.1 }, scene);
    wallBack.position = new Vector3(0, 2.5, -5);
    wallBack.material = wallGridMaterial;

    // left wall
    const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: 0.1, height: 5, depth: 10 }, scene);
    wallLeft.position = new Vector3(-5, 2.5, 0);
    wallLeft.material = wallGridMaterial;

    // right wall
    const wallRight = MeshBuilder.CreateBox("wallRight", { width: 0.1, height: 5, depth: 10 }, scene);
    wallRight.position = new Vector3(5, 2.5, 0);
    wallRight.material = wallGridMaterial;

    // --- CABINET (placeholder) ---
    const cabinet = MeshBuilder.CreateBox("cabinet", { width: 2, height: 1, depth: 0.5 }, scene);
    cabinet.position = new Vector3(0, 0.5, 0); // half of height so it sits on ground
    const cabinetMaterial = new StandardMaterial("cabinetMaterial", scene);
    cabinetMaterial.diffuseColor = new Color3(0.76, 0.60, 0.42); // warm wood colour
    cabinet.material = cabinetMaterial;

    // Drag behaviour
    const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) }); // constrained to ground only
    cabinet.addBehavior(dragBehavior);

    return scene;
}