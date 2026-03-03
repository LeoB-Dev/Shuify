import {
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    DirectionalLight,
    MeshBuilder,
    StandardMaterial,
    Color3,
    DynamicTexture,
} from "@babylonjs/core";

export function createScene(engine, canvas) {
    const scene = new Scene(engine);

    // --- CAMERA ---
    const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 32, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.upperBetaLimit = 1.5;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 130;

    // --- LIGHTING ---
    // Hemisphere: both sky and ground kept bright so vertical walls get good fill.
    // Vertical surfaces receive the midpoint between skyColor and groundColor,
    // so both need to be light to avoid dark walls.
    const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambient.intensity   = 1.0;
    ambient.diffuse     = new Color3(1.00, 0.97, 0.93); // warm white sky
    ambient.groundColor = new Color3(0.88, 0.84, 0.78); // warm ground bounce (nearly as bright as sky)

    // Directional light coming from the front-right-above (+X, +Y, +Z → toward room interior).
    // Direction is where rays TRAVEL, so (-0.5, -1, -0.4) means light comes FROM (+X, +Y, +Z).
    //   back wall  inner face normal +Z → dot with +0.4 → lit
    //   left wall  inner face normal +X → dot with +0.5 → well lit
    //   right wall inner face normal -X → dot with -0.5 → no direct contribution (darker)
    const sun = new DirectionalLight("sun", new Vector3(-0.5, -1.0, -0.4), scene);
    sun.intensity = 0.22;
    sun.diffuse   = new Color3(1.00, 0.96, 0.88);

    // --- WALL TEXTURE — plaster grain via canvas noise ---
    const wallTex = new DynamicTexture("wallTex", { width: 512, height: 512 }, scene, false);
    const wCtx = wallTex.getContext();
    wCtx.fillStyle = "#ecdfd0";          // warm beige base
    wCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
        const x    = Math.random() * 512;
        const y    = Math.random() * 512;
        const v    = Math.floor(Math.random() * 20 - 10);
        const size = Math.random() < 0.2 ? 3 : 2;
        wCtx.fillStyle = `rgb(${236 + v},${223 + v},${208 + v})`;
        wCtx.fillRect(x, y, size, size);
    }
    wallTex.update();

    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture              = wallTex;
    wallMat.diffuseTexture.uScale       = 3;
    wallMat.diffuseTexture.vScale       = 3;
    wallMat.specularColor               = new Color3(0.03, 0.03, 0.03);

    // --- FLOOR TEXTURE — wood planks running front-to-back ---
    // Ground UV: U = X (left-right), V = Z (front-back).
    // Vertical stripes in the texture = planks running front-to-back in the scene.
    // Use 4 planks at exactly 128 px each (512 / 4 = 128, no fractional pixels).
    // Fill the entire canvas first so no black gaps can appear.
    const floorTex = new DynamicTexture("floorTex", { width: 512, height: 512 }, scene, false);
    const fCtx = floorTex.getContext();

    // Solid base fill — canvas starts transparent/black without this
    fCtx.fillStyle = "#b8956a";
    fCtx.fillRect(0, 0, 512, 512);

    const plankColors = ["#bf9b6e", "#b39062", "#c8a47a", "#b69570"];
    for (let col = 0; col < 4; col++) {
        const px = col * 128;
        // Plank face (slightly different shade per plank)
        fCtx.fillStyle = plankColors[col];
        fCtx.fillRect(px, 0, 126, 512);
        // Subtle lengthwise grain lines
        for (let g = 0; g < 6; g++) {
            const gy = Math.random() * 512;
            fCtx.strokeStyle = "rgba(65,40,15,0.07)";
            fCtx.lineWidth = 1;
            fCtx.beginPath();
            fCtx.moveTo(px, gy);
            fCtx.lineTo(px + 126, gy + (Math.random() * 14 - 7));
            fCtx.stroke();
        }
        // Narrow side gap
        fCtx.fillStyle = "rgba(55,33,12,0.22)";
        fCtx.fillRect(px + 126, 0, 2, 512);
        // Staggered end seam
        const seamV = (col % 2 === 0) ? 256 : 128;
        fCtx.fillStyle = "rgba(55,33,12,0.15)";
        fCtx.fillRect(px, seamV,       126, 2);
        fCtx.fillRect(px, seamV + 256, 126, 2);
    }
    floorTex.update();

    const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseTexture        = floorTex;
    floorMat.diffuseTexture.uScale = 4;  // 4 repeats × 4 planks = 16 planks across room
    floorMat.diffuseTexture.vScale = 1;  // planks run full depth of room
    floorMat.specularColor         = new Color3(0.12, 0.10, 0.07);
    ground.material = floorMat;

    // --- WALLS ---
    const wallBack = MeshBuilder.CreateBox("wallBack", { width: 10, height: 5, depth: 0.1 }, scene);
    wallBack.position = new Vector3(0, 2.5, -5);
    wallBack.material = wallMat;

    const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: 0.1, height: 5, depth: 10 }, scene);
    wallLeft.position = new Vector3(-5, 2.5, 0);
    wallLeft.material = wallMat;

    const wallRight = MeshBuilder.CreateBox("wallRight", { width: 0.1, height: 5, depth: 10 }, scene);
    wallRight.position = new Vector3(5, 2.5, 0);
    wallRight.material = wallMat;

    return scene;
}
