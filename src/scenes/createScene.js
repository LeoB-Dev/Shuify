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
    ambient.intensity = 1.0;
    ambient.diffuse = new Color3(1.00, 0.97, 0.93); // warm white sky
    ambient.groundColor = new Color3(0.88, 0.84, 0.78); // warm ground bounce (nearly as bright as sky)

    // Directional light coming from the front-right-above (+X, +Y, +Z → toward room interior).
    // Direction is where rays TRAVEL, so (-0.5, -1, -0.4) means light comes FROM (+X, +Y, +Z).
    //   back wall  inner face normal +Z → dot with +0.4 → lit
    //   left wall  inner face normal +X → dot with +0.5 → well lit
    //   right wall inner face normal -X → dot with -0.5 → no direct contribution (darker)
    const sun = new DirectionalLight("sun", new Vector3(-0.5, -1.0, -0.4), scene);
    sun.intensity = 0.22;
    sun.diffuse = new Color3(1.00, 0.96, 0.88);

    // --- COLOURS — edit these hex values to change wall/floor colours ---
    const WALL_COLOR  = "#ecdfd0"; // ← change hex to update wall colour
    const FLOOR_COLOR = "#c8b89a"; // ← change hex to update floor colour

    // --- WALL TEXTURE — plaster grain via canvas noise ---
    const wallTex = new DynamicTexture("wallTex", { width: 512, height: 512 }, scene, false);
    const wCtx = wallTex.getContext();
    wCtx.fillStyle = WALL_COLOR;
    wCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const v = Math.floor(Math.random() * 20 - 10);
        const size = Math.random() < 0.2 ? 3 : 2;
        wCtx.fillStyle = `rgb(${236 + v},${223 + v},${208 + v})`;
        wCtx.fillRect(x, y, size, size);
    }
    wallTex.update();

    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture = wallTex;
    wallMat.diffuseTexture.uScale = 3;
    wallMat.diffuseTexture.vScale = 3;
    wallMat.specularColor = new Color3(0.03, 0.03, 0.03);

    const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = Color3.FromHexString(FLOOR_COLOR);
    floorMat.specularColor = new Color3(0.03, 0.03, 0.03);
    ground.material = floorMat;

    // --- WALLS ---
    // isPickable = false so walls never intercept furniture drag/rotate picks.
    // Wall-item placement (TV, window, door) temporarily re-enables picking in App.jsx.
    const wallBack = MeshBuilder.CreateBox("wallBack", { width: 10, height: 5, depth: 0.1 }, scene);
    wallBack.position = new Vector3(0, 2.5, -5);
    wallBack.material = wallMat;
    wallBack.isPickable = false;

    const wallFront = MeshBuilder.CreateBox("wallFront", { width: 10, height: 5, depth: 0.1 }, scene);
    wallFront.position = new Vector3(0, 2.5, 5);
    wallFront.material = wallMat;
    wallFront.isPickable = false;

    const wallLeft = MeshBuilder.CreateBox("wallLeft", { width: 0.1, height: 5, depth: 10 }, scene);
    wallLeft.position = new Vector3(-5, 2.5, 0);
    wallLeft.material = wallMat;
    wallLeft.isPickable = false;

    const wallRight = MeshBuilder.CreateBox("wallRight", { width: 0.1, height: 5, depth: 10 }, scene);
    wallRight.position = new Vector3(5, 2.5, 0);
    wallRight.material = wallMat;
    wallRight.isPickable = false;

    // Each wall paired with its outward normal (pointing away from room interior)
    const walls = [
        { mesh: wallBack, nx: 0, nz: -1 },
        { mesh: wallFront, nx: 0, nz: 1 },
        { mesh: wallLeft, nx: -1, nz: 0 },
        { mesh: wallRight, nx: 1, nz: 0 },
    ];

    // Every frame: find the wall whose outward normal most aligns with the camera direction,
    // then smoothly fade that wall out so the user always sees into the room.
    scene.registerBeforeRender(() => {
        const cp = camera.position;
        const len = Math.sqrt(cp.x * cp.x + cp.z * cp.z) || 1;
        const cx = cp.x / len;
        const cz = cp.z / len;

        let maxDot = -Infinity;
        let facingWall = null;
        for (const w of walls) {
            const dot = cx * w.nx + cz * w.nz;
            if (dot > maxDot) { maxDot = dot; facingWall = w; }
        }

        for (const w of walls) {
            const target = w === facingWall ? 0.0 : 1.0;
            w.mesh.visibility += (target - w.mesh.visibility) * 0.12;
        }
    });

    return scene;
}
