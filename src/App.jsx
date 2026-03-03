import { useRef } from "react";
import BabylonCanvas from "./components/BabylonCanvas";
import Sidebar from "./components/Sidebar";
import useSceneStore from "./store/useSceneStore";
import { MeshBuilder, PointerDragBehavior, Vector3, StandardMaterial, Color3 } from "@babylonjs/core";
// Module-level ImportMeshAsync is the Babylon 8.x replacement for the deprecated SceneLoader.ImportMeshAsync
import { ImportMeshAsync } from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registers the GLB/glTF plugin so ImportMeshAsync can handle .glb files

export default function App() {
  // sceneRef holds the live Babylon scene, shared between drag events and spawn functions
  const sceneRef = useRef(null);
  // draggingItemRef is a ref copy of the store value so drop handlers always see the latest item
  const draggingItemRef = useRef(null);
  // meshRegistryRef maps uid → mesh for every placed item so collision tests can check all of them
  const meshRegistryRef = useRef({});

  // Tests whether moving `mesh` to (newX, newY, newZ) would cause it to overlap any other
  // registered mesh. Temporarily applies the candidate position, refreshes the world matrix
  // for an accurate AABB, then restores — all synchronously before the next render frame.
  const testCollision = (mesh, newX, newY, newZ) => {
    const saved = mesh.position.clone();
    mesh.position.set(newX, newY, newZ);
    mesh.computeWorldMatrix(true);
    const collides = Object.values(meshRegistryRef.current).some((other) => {
      if (other === mesh) return false;
      return mesh.intersectsMesh(other, false); // false = AABB (sufficient for axis-aligned boxes)
    });
    mesh.position.copyFrom(saved);
    mesh.computeWorldMatrix(true);
    return collides;
  };
  const draggingItem = useSceneStore((s) => s.draggingItem);
  const addPlacedItem = useSceneStore((s) => s.addPlacedItem);
  const updateItem = useSceneStore((s) => s.updateItem);

  draggingItemRef.current = draggingItem;

  // Allows the dragged sidebar element to be dropped onto the canvas
  const handleDragOver = (e) => e.preventDefault();

  // Spawns a simple Babylon box mesh for items that don't have a GLB model
  const spawnBox = (scene, item, px, pz) => {
    const { width, height, depth } = item.dimensions;
    const mesh = MeshBuilder.CreateBox(item.id, { width, height, depth }, scene);
    // Position so the bottom of the box sits on the floor (y=0)
    mesh.position.x = px;
    mesh.position.y = height / 2;
    mesh.position.z = pz;
    const uid = Date.now();
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });
    meshRegistryRef.current[uid] = mesh;
    // Constrain dragging to the horizontal ground plane
    const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    // moveAttached=false + absolute dragPlanePoint avoids dead zones at walls and collisions.
    // grabOffset records the cursor-to-mesh delta at drag start; desired = dragPlanePoint + grabOffset.
    dragBehavior.moveAttached = false;
    let grabOffsetX = 0, grabOffsetZ = 0;
    dragBehavior.onDragStartObservable.add((event) => {
      grabOffsetX = mesh.position.x - event.dragPlanePoint.x;
      grabOffsetZ = mesh.position.z - event.dragPlanePoint.z;
    });
    dragBehavior.onDragObservable.add((event) => {
      const newX = Math.max(-5 + width / 2, Math.min(5 - width / 2, event.dragPlanePoint.x + grabOffsetX));
      const newZ = Math.max(-5 + depth / 2, Math.min(5 - depth / 2, event.dragPlanePoint.z + grabOffsetZ));
      if (!testCollision(mesh, newX, mesh.position.y, newZ)) {
        mesh.position.x = newX;
        mesh.position.z = newZ;
      }
      // Always resync: whether blocked by a wall, collision, or neither.
      // Cursor reversal then immediately produces 1:1 movement from wherever the cursor is.
      grabOffsetX = mesh.position.x - event.dragPlanePoint.x;
      grabOffsetZ = mesh.position.z - event.dragPlanePoint.z;
    });
    dragBehavior.onDragEndObservable.add(() => { updateItem(uid, { x: mesh.position.x, z: mesh.position.z }); });
    mesh.addBehavior(dragBehavior);
  };

  // Spawns a real GLB model with an invisible hitbox for dragging
  const spawnGLB = async (scene, item, px, pz) => {
    try {
      // Load the GLB from /public/models/<id>.glb
      const result = await ImportMeshAsync(`/models/${item.id}.glb`, scene);

      // Walk up the parent chain from the first geometry mesh to find the true scene root
      // (the topmost ancestor with no parent). This is more reliable than searching
      // transformNodes, which may contain unrelated nodes in Babylon 8.x.
      let root = result.meshes[0];
      while (root.parent) root = root.parent;

      // Fix orientation: -PI/2 on X converts the model from Z-up (model space) to Y-up (world),
      // -PI/2 on Y rotates it to face the open wall (+Z direction)
      root.rotation = new Vector3(-Math.PI / 2, -Math.PI / 2, 0);
      root.position.set(px, 0, pz);

      // Force every mesh's world matrix to update with the new root orientation
      result.meshes.forEach((m) => m.computeWorldMatrix(true));

      // Compute the world AABB by iterating every visual mesh individually.
      // This is safer than getHierarchyBoundingVectors() which can miss meshes
      // if result.meshes[0] isn't actually the hierarchy root.
      let minY = Infinity, maxY = -Infinity;
      let minX = Infinity, maxX = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      result.meshes.forEach((m) => {
        const bi = m.getBoundingInfo();
        if (!bi) return;
        const wMin = bi.boundingBox.minimumWorld;
        const wMax = bi.boundingBox.maximumWorld;
        if (wMin.y < minY) minY = wMin.y;
        if (wMax.y > maxY) maxY = wMax.y;
        if (wMin.x < minX) minX = wMin.x;
        if (wMax.x > maxX) maxX = wMax.x;
        if (wMin.z < minZ) minZ = wMin.z;
        if (wMax.z > maxZ) maxZ = wMax.z;
      });

      const modelHeight = maxY - minY;
      // Lift so model bottom sits just above the floor. A tiny positive offset (0.002)
      // prevents z-fighting between the model's bottom face and the ground mesh at y=0.
      const floorY = -minY + 0.002;

      const hitboxWorldY = modelHeight / 2; // centre of model in world Y once it's on the floor

      // Invisible hitbox centred at the model's midpoint
      const hitbox = MeshBuilder.CreateBox(`${item.id}_hitbox`, {
        width: maxX - minX,
        height: modelHeight,
        depth: maxZ - minZ,
      }, scene);
      hitbox.visibility = 0;
      hitbox.position.set(px, hitboxWorldY, pz);

      // Parent the model root to the hitbox so it moves atomically — no per-frame sync needed
      root.parent = hitbox;
      root.position.set(0, floorY - hitboxWorldY, 0); // local offset within hitbox

      // Only the hitbox should receive pointer events — sub-meshes would intercept clicks
      result.meshes.forEach((m) => { m.isPickable = false; });

      const uid = Date.now();
      addPlacedItem({ uid, id: item.id, label: item.label, modelType: "glb", x: px, z: pz });
      meshRegistryRef.current[uid] = hitbox;
      // Constrain dragging to the ground plane, same as box items
      const halfW = (maxX - minX) / 2;
      const halfD = (maxZ - minZ) / 2;
      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
      dragBehavior.moveAttached = false;
      let grabOffsetX = 0, grabOffsetZ = 0;
      dragBehavior.onDragStartObservable.add((event) => {
        grabOffsetX = hitbox.position.x - event.dragPlanePoint.x;
        grabOffsetZ = hitbox.position.z - event.dragPlanePoint.z;
      });
      dragBehavior.onDragObservable.add((event) => {
        const newX = Math.max(-5 + halfW, Math.min(5 - halfW, event.dragPlanePoint.x + grabOffsetX));
        const newZ = Math.max(-5 + halfD, Math.min(5 - halfD, event.dragPlanePoint.z + grabOffsetZ));
        if (!testCollision(hitbox, newX, hitbox.position.y, newZ)) {
          hitbox.position.x = newX;
          hitbox.position.z = newZ;
          // root follows hitbox automatically via parenting — no manual sync
        }
        // Always resync: handles wall clamping and collision blocking uniformly.
        grabOffsetX = hitbox.position.x - event.dragPlanePoint.x;
        grabOffsetZ = hitbox.position.z - event.dragPlanePoint.z;
      });
      dragBehavior.onDragEndObservable.add(() => { updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }); });
      hitbox.addBehavior(dragBehavior);
    } catch (error) {
      console.error("GLB load error:", error);
    }
  };

  // Spawns a TV box flush against whichever wall the user drops it on, draggable along that wall.
  // When released past the halfway point toward an adjacent wall it snaps to that new wall.
  const spawnWallBox = (scene, item, pickResult) => {
    const { width, height, depth } = item.dimensions;
    const pt = pickResult.pickedPoint;
    const hitName = pickResult.pickedMesh?.name ?? "";

    // Determine which wall was hit; fall back to the nearest wall from the pick point
    let initialWall;
    if (hitName === "wallBack") initialWall = "back";
    else if (hitName === "wallLeft") initialWall = "left";
    else if (hitName === "wallRight") initialWall = "right";
    else {
      const dBack = Math.abs(pt.z + 5);
      const dLeft = Math.abs(pt.x + 5);
      const dRight = Math.abs(pt.x - 5);
      if (dBack <= dLeft && dBack <= dRight) initialWall = "back";
      else if (dLeft <= dRight) initialWall = "left";
      else initialWall = "right";
    }

    // Use pick-point height, clamped to valid range; fall back to 2.0 if dropped on the floor
    const spawnY = Math.max(height / 2, Math.min(5 - height / 2, pt.y > height / 2 ? pt.y : 2.0));

    const uid = Date.now();

    // Shared material — created once and reused when the mesh is rebuilt on a new wall
    const mat = new StandardMaterial(`${item.id}_mat_${uid}`, scene);
    mat.diffuseColor = new Color3(0.08, 0.08, 0.1);

    // Holds the active mesh so it can be disposed when switching walls
    let activeMesh = null;
    let placed = false; // addPlacedItem is called once, after the first mesh is positioned

    const buildOnWall = (wall, posX, posZ, posY) => {
      if (activeMesh) activeMesh.dispose();

      let mesh, dragNormal, lockFn;

      // grabOffsetA = grab offset along the wall's sliding axis (x for back wall, z for side walls)
      // grabOffsetY = grab offset in the vertical axis (shared by all walls)
      let grabOffsetA = 0, grabOffsetY = 0;

      if (wall === "back") {
        const wallZ = -4.9;
        mesh = MeshBuilder.CreateBox(`${item.id}_${uid}`, { width, height, depth }, scene);
        mesh.position.set(Math.max(-5 + width / 2, Math.min(5 - width / 2, posX)), posY, wallZ);
        dragNormal = new Vector3(0, 0, 1);
        // dragPlanePoint.x slides along the wall, .y moves up/down; Z always pinned to the wall face
        lockFn = (event) => {
          const newX = Math.max(-5 + width / 2, Math.min(5 - width / 2, event.dragPlanePoint.x + grabOffsetA));
          const newY = Math.max(height / 2, Math.min(5 - height / 2, event.dragPlanePoint.y + grabOffsetY));
          if (!testCollision(mesh, newX, newY, wallZ)) {
            mesh.position.x = newX;
            mesh.position.y = newY;
          }
          grabOffsetA = mesh.position.x - event.dragPlanePoint.x;
          grabOffsetY = mesh.position.y - event.dragPlanePoint.y;
          mesh.position.z = wallZ;
        };
      } else {
        // For side walls: build the box with dimensions already oriented for the wall so no
        // mesh rotation is needed. Rotation would cause PointerDragBehavior to transform
        // dragPlaneNormal into local space, sending the TV off the wall when dragged.
        // depth (0.05) → world X (flush to wall), width (1.6) → world Z (spans wall)
        const wallX = wall === "left" ? -4.9 : 4.9;
        mesh = MeshBuilder.CreateBox(`${item.id}_${uid}`, { width: depth, height, depth: width }, scene);
        mesh.position.set(wallX, posY, Math.max(-5 + width / 2, Math.min(5 - width / 2, posZ)));
        dragNormal = wall === "left" ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
        // dragPlanePoint.z slides along the wall, .y moves up/down; X always pinned to the wall face
        lockFn = (event) => {
          const newZ = Math.max(-5 + width / 2, Math.min(5 - width / 2, event.dragPlanePoint.z + grabOffsetA));
          const newY = Math.max(height / 2, Math.min(5 - height / 2, event.dragPlanePoint.y + grabOffsetY));
          if (!testCollision(mesh, wallX, newY, newZ)) {
            mesh.position.z = newZ;
            mesh.position.y = newY;
          }
          grabOffsetA = mesh.position.z - event.dragPlanePoint.z;
          grabOffsetY = mesh.position.y - event.dragPlanePoint.y;
          mesh.position.x = wallX;
        };
      }

      mesh.material = mat;
      activeMesh = mesh;
      meshRegistryRef.current[uid] = mesh; // always points to the live mesh, even after wall switches

      // Register the item in the store the first time a mesh is built (using its snapped position)
      if (!placed) {
        placed = true;
        addPlacedItem({
          uid, id: item.id, label: item.label, modelType: "wall",
          x: mesh.position.x, z: mesh.position.z, y: mesh.position.y, wall,
        });
      }

      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: dragNormal });
      dragBehavior.moveAttached = false;
      dragBehavior.onDragStartObservable.add((event) => {
        grabOffsetA = wall === "back"
          ? mesh.position.x - event.dragPlanePoint.x
          : mesh.position.z - event.dragPlanePoint.z;
        grabOffsetY = mesh.position.y - event.dragPlanePoint.y;
      });
      dragBehavior.onDragObservable.add(lockFn);
      dragBehavior.onDragEndObservable.add(() => {
        // Snapshot position before any disposal
        const x = mesh.position.x, y = mesh.position.y, z = mesh.position.z;

        // Snap to an adjacent wall if the TV has been dragged past the halfway point (±2.5)
        // Back ↔ left/right walls share corners at x = ±5; side walls connect to back at z = -5.
        let nextWall = null;
        if (wall === "back") {
          if (x < -2.5) nextWall = "left";
          else if (x > 2.5) nextWall = "right";
        } else {
          // left or right wall — the only adjacent wall with items is the back wall (z = -5)
          if (z < -2.5) nextWall = "back";
        }

        if (nextWall) buildOnWall(nextWall, x, z, y);
        // Persist full wall-item state: position on the current wall + which wall it's on
        updateItem(uid, { x, z, y, wall: nextWall ?? wall });
      });

      mesh.addBehavior(dragBehavior);
    };

    buildOnWall(initialWall, pt.x, pt.z, spawnY);
  };

  // Spawns a detailed multi-mesh bed (frame, headboard, footboard, legs, mattress, blanket, pillows).
  // All visual meshes are parented to an invisible hitbox that handles collision and drag.
  const spawnBed = (scene, item, px, pz) => {
    const W   = 1.6;    // overall width  (X)
    const D   = 2.0;    // overall depth  (Z)
    const hbH = 0.82;   // headboard height = bounding-box height

    const uid = Date.now();
    const hitbox = MeshBuilder.CreateBox(`bed_${uid}`, { width: W, height: hbH, depth: D }, scene);
    hitbox.visibility = 0;
    hitbox.position.set(px, hbH / 2, pz);
    meshRegistryRef.current[uid] = hitbox;
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });

    // Convert a world-Y value (height above floor) to hitbox-local Y
    const wly = (wy) => wy - hbH / 2;

    // Create a box mesh parented to the hitbox with a StandardMaterial
    const addBox = (name, dims, lx, ly, lz, r, g, b, sr = 0.08, sg = 0.06, sb = 0.03) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent = hitbox;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      const mat = new StandardMaterial(`${name}_mat`, scene);
      mat.diffuseColor = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      m.material = mat;
      return m;
    };

    // ── Frame slab ───────────────────────────────────────────────────────
    const fH  = 0.28;
    const hbT = 0.10;   // headboard thickness (Z)
    const fbT = 0.08;   // footboard thickness (Z)

    addBox('bed_frame', { width: W, height: fH, depth: D },
      0, wly(fH / 2), 0,
      0.32, 0.18, 0.07, 0.18, 0.12, 0.05);

    // Slim side rails sitting on top of the frame
    const railH = 0.06, railT = 0.06;
    [-(W / 2 - railT / 2), W / 2 - railT / 2].forEach((rx, i) => {
      addBox(`bed_rail_${i}`, { width: railT, height: railH, depth: D - 0.04 },
        rx, wly(fH + railH / 2), 0,
        0.28, 0.15, 0.06, 0.15, 0.10, 0.04);
    });

    // ── Turned cylindrical legs (four corners) ───────────────────────────
    const legR = 0.04, legH = 0.30;
    [
      [-(W / 2 - 0.07), -(D / 2 - hbT - 0.07)],
      [ (W / 2 - 0.07), -(D / 2 - hbT - 0.07)],
      [-(W / 2 - 0.07),  (D / 2 - fbT - 0.07)],
      [ (W / 2 - 0.07),  (D / 2 - fbT - 0.07)],
    ].forEach(([lx, lz], i) => {
      const cyl = MeshBuilder.CreateCylinder(`bed_leg_${i}`,
        { diameter: legR * 2, height: legH, tessellation: 12 }, scene);
      cyl.parent = hitbox;
      cyl.position.set(lx, wly(legH / 2), lz);
      cyl.isPickable = false;
      const mat = new StandardMaterial(`bed_leg_${i}_mat`, scene);
      mat.diffuseColor = new Color3(0.22, 0.12, 0.05);
      mat.specularColor = new Color3(0.28, 0.20, 0.09);
      cyl.material = mat;
    });

    // ── Headboard ────────────────────────────────────────────────────────
    const hbZ = -D / 2 + hbT / 2;              // local Z centre of headboard panel
    const hbFrontZ = hbZ + hbT / 2;            // local Z of its front (room-facing) surface

    addBox('bed_headboard', { width: W + 0.06, height: hbH, depth: hbT },
      0, wly(hbH / 2), hbZ,
      0.28, 0.15, 0.06, 0.20, 0.14, 0.06);

    // Two raised decorative panels
    const panelW = (W - 0.18) / 2;
    const panelH = hbH - 0.26;
    [-W / 4, W / 4].forEach((px2, i) => {
      addBox(`bed_hbpanel_${i}`, { width: panelW, height: panelH, depth: 0.025 },
        px2, wly(0.15 + panelH / 2), hbFrontZ + 0.013,
        0.42, 0.26, 0.10, 0.12, 0.09, 0.04);
    });

    // Vertical centre divider between the panels
    addBox('bed_hb_divider', { width: 0.04, height: panelH, depth: 0.02 },
      0, wly(0.15 + panelH / 2), hbFrontZ + 0.01,
      0.30, 0.17, 0.07, 0.12, 0.09, 0.04);

    // Capping rail across the top of the headboard
    addBox('bed_hb_topcap', { width: W + 0.06, height: 0.08, depth: hbT + 0.02 },
      0, wly(hbH - 0.04), hbZ,
      0.24, 0.13, 0.05, 0.28, 0.20, 0.09);

    // ── Footboard ────────────────────────────────────────────────────────
    const fbH = 0.45;
    const fbZ = D / 2 - fbT / 2;

    addBox('bed_footboard', { width: W + 0.06, height: fbH, depth: fbT },
      0, wly(fbH / 2), fbZ,
      0.28, 0.15, 0.06, 0.20, 0.14, 0.06);

    addBox('bed_fb_topcap', { width: W + 0.06, height: 0.06, depth: fbT + 0.02 },
      0, wly(fbH - 0.03), fbZ,
      0.24, 0.13, 0.05, 0.28, 0.20, 0.09);

    // ── Mattress ─────────────────────────────────────────────────────────
    const mH  = 0.22;
    const mD  = D - hbT - fbT - 0.04;
    const mZ  = (hbT - fbT) / 2;             // slight offset because boards differ in thickness
    const mTop = fH + mH;                    // world Y of mattress top surface

    addBox('bed_mattress', { width: W - 0.06, height: mH, depth: mD },
      0, wly(fH + mH / 2), mZ,
      0.93, 0.90, 0.84, 0.04, 0.04, 0.04);

    // Piping strips around mattress perimeter (four thin darker bands)
    const pip = 0.04;
    [
      { dims: { width: W - 0.06, height: mH, depth: pip }, lx: 0,              lz: mZ + mD / 2 - pip / 2 },
      { dims: { width: W - 0.06, height: mH, depth: pip }, lx: 0,              lz: mZ - mD / 2 + pip / 2 },
      { dims: { width: pip,      height: mH, depth: mD  }, lx: -(W - 0.06) / 2 + pip / 2, lz: mZ },
      { dims: { width: pip,      height: mH, depth: mD  }, lx:  (W - 0.06) / 2 - pip / 2, lz: mZ },
    ].forEach(({ dims, lx, lz }, i) => {
      addBox(`bed_pip_${i}`, dims, lx, wly(fH + mH / 2), lz,
        0.77, 0.74, 0.67, 0.03, 0.03, 0.03);
    });

    // ── Blanket/duvet (covers foot ~58 % of mattress) ────────────────────
    const blH = 0.10;
    const blD = mD * 0.58;
    const blZ = mZ + mD / 2 - blD / 2;     // centres the blanket over the foot portion

    addBox('bed_blanket', { width: W - 0.10, height: blH, depth: blD },
      0, wly(mTop + blH / 2), blZ,
      0.38, 0.48, 0.62, 0.05, 0.06, 0.08);

    // Folded cuff at the head-side edge of the blanket (lighter, slightly raised)
    const cuffH = 0.07;
    addBox('bed_blanket_cuff', { width: W - 0.10, height: cuffH, depth: 0.16 },
      0, wly(mTop + blH + cuffH / 2), blZ - blD / 2 + 0.08,
      0.55, 0.62, 0.74, 0.06, 0.07, 0.09);

    // ── Pillows ───────────────────────────────────────────────────────────
    const plW = W / 2 - 0.12;
    const plD = 0.44;
    const plH = 0.10;
    const plZ = mZ - mD / 2 + 0.05 + plD / 2;   // near the headboard end

    [-W / 4 + 0.03, W / 4 - 0.03].forEach((plX, i) => {
      addBox(`bed_pillow_${i}`, { width: plW, height: plH, depth: plD },
        plX, wly(mTop + plH / 2), plZ,
        0.97, 0.96, 0.92, 0.06, 0.06, 0.06);
    });

    // ── Drag behaviour on hitbox ─────────────────────────────────────────
    const halfW = W / 2, halfD = D / 2;
    const drag = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    drag.moveAttached = false;
    let grabX = 0, grabZ = 0;
    drag.onDragStartObservable.add((ev) => {
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragObservable.add((ev) => {
      const nx = Math.max(-5 + halfW, Math.min(5 - halfW, ev.dragPlanePoint.x + grabX));
      const nz = Math.max(-5 + halfD, Math.min(5 - halfD, ev.dragPlanePoint.z + grabZ));
      if (!testCollision(hitbox, nx, hitbox.position.y, nz)) {
        hitbox.position.x = nx;
        hitbox.position.z = nz;
      }
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragEndObservable.add(() => updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }));
    hitbox.addBehavior(drag);
  };

  // Items whose id matches a file in /public/models/ are loaded as GLB; everything else is a box
  const GLB_ITEMS = ["shelf"];

  // On drop, ray-cast into the scene to find the floor point under the cursor,
  // then spawn the dragged item at that world position
  const handleDrop = (e) => {
    e.preventDefault();
    const scene = sceneRef.current;
    const item = draggingItemRef.current;
    if (!scene || !item) return;

    // Convert browser pointer coordinates to canvas-local coordinates
    const canvas = scene.getEngine().getRenderingCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Pick against the scene to get the 3D world position on the floor
    const pickResult = scene.pick(x, y);
    if (!pickResult.hit) return;

    const { x: px, z: pz } = pickResult.pickedPoint;

    if (item.mountType === "wall") {
      spawnWallBox(scene, item, pickResult);
    } else if (GLB_ITEMS.includes(item.id)) {
      spawnGLB(scene, item, px, pz);
    } else if (item.id === "bed") {
      spawnBed(scene, item, px, pz);
    } else {
      spawnBox(scene, item, px, pz);
    }
  };

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <Sidebar />
      {/* Canvas area fills the remaining space after the sidebar / bottom bar */}
      <div
        className="absolute top-0 right-0 bottom-44 left-0 md:bottom-0 md:left-64"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <BabylonCanvas onSceneReady={(scene) => {
          sceneRef.current = scene;
          // Register the pre-placed cabinet so spawned items collide with it too
          const cabinet = scene.getMeshByName("cabinet");
          if (cabinet) meshRegistryRef.current["cabinet"] = cabinet;
        }} />
      </div>
    </div>
  );
}
