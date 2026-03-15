import { useRef, useEffect, useState } from "react";
import BabylonCanvas from "./components/BabylonCanvas";
import Sidebar from "./components/Sidebar";
import useSceneStore from "./store/useSceneStore";
import { MeshBuilder, PointerDragBehavior, Vector3, StandardMaterial, Color3, PointerEventTypes } from "@babylonjs/core";
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
  // rotClampRef maps uid → { halfW, halfD } — mutable so right-click rotation can swap them
  const rotClampRef = useRef({});
  // Monotonic counter for unique item uids — avoids Date.now() collisions when multiple items
  // are spawned synchronously in the same millisecond (e.g. during room reload).
  const uidCounter = useRef(1);

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

  // Returns true if the mesh can move to (newX, newY, newZ).
  // If the mesh is already overlapping something at its current position (stuck), any move is
  // allowed so it can escape. Otherwise, only moves that don't create a new collision are allowed.
  const canMoveTo = (mesh, newX, newY, newZ) => {
    if (testCollision(mesh, mesh.position.x, mesh.position.y, mesh.position.z)) return true;
    return !testCollision(mesh, newX, newY, newZ);
  };
  const [hintVisible, setHintVisible] = useState(true);
  const [touchGhost, setTouchGhost] = useState(null); // { x, y, label } while finger is dragging

  const draggingItem = useSceneStore((s) => s.draggingItem);
  const placedItems = useSceneStore((s) => s.placedItems);
  const clearDraggingItem = useSceneStore((s) => s.clearDraggingItem);
  const addPlacedItem = useSceneStore((s) => s.addPlacedItem);
  const updateItem = useSceneStore((s) => s.updateItem);
  const removeItem = useSceneStore((s) => s.removeItem);
  const clearPlacedItems = useSceneStore((s) => s.clearPlacedItems);
  const pendingLoad = useSceneStore((s) => s.pendingLoad);
  const clearPendingLoad = useSceneStore((s) => s.clearPendingLoad);
  const pendingDeleteUid = useSceneStore((s) => s.pendingDeleteUid);
  const clearPendingDelete = useSceneStore((s) => s.clearPendingDelete);

  draggingItemRef.current = draggingItem;

  // Dimensions for every item type, used when rebuilding catalogItem during room reload.
  // Wall-item spawners (tv, window, door) and spawnBox require item.dimensions at runtime.
  // Floor-item spawners (bed, desk, chair, couch) hardcode their own dims but entries are
  // included here so any future spawnBox fallback has correct data.
  // GLB spawners (shelf) derive dims from the model AABB and ignore item.dimensions,
  // but the entry is included to avoid undefined for any code that inspects catalogItem.
  const ITEM_DIMS = {
    tv:     { width: 1.6, height: 0.9,  depth: 0.05 },
    window: { width: 1.4, height: 1.2,  depth: 0.12 },
    door:   { width: 1.4, height: 3.2,  depth: 0.12 },
    shelf:  { width: 1.4, height: 0.14, depth: 0.21 },
    bed:    { width: 2.8, height: 1.05, depth: 4.0  },
    desk:   { width: 2.2, height: 0.76, depth: 1.0  },
    chair:  { width: 0.58, height: 0.88, depth: 0.55 },
    couch:  { width: 2.0, height: 0.90, depth: 0.90 },
  };

  // Holds the latest spawn-at-position function so touch handlers never go stale
  const spawnAtClientPosRef = useRef(null);

  // Global touch handlers — mounted once, use refs so they always see current state.
  // HTML5 drag events don't fire on mobile; instead we track touchstart (Sidebar),
  // touchmove (show ghost + prevent scroll), and touchend (spawn at finger position).
  useEffect(() => {
    const onTouchMove = (e) => {
      if (!draggingItemRef.current) return;
      e.preventDefault(); // stop page scroll while dragging a furniture item
      const t = e.touches[0];
      setTouchGhost({ x: t.clientX, y: t.clientY, label: draggingItemRef.current.label });
    };
    const onTouchEnd = (e) => {
      if (!draggingItemRef.current) return;
      const t = e.changedTouches[0];
      setTouchGhost(null);
      spawnAtClientPosRef.current?.(t.clientX, t.clientY);
      clearDraggingItem();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // runs once — handlers read refs so they never go stale

  // Allows the dragged sidebar element to be dropped onto the canvas
  const handleDragOver = (e) => e.preventDefault();

  // Spawns a simple Babylon box mesh for items that don't have a GLB model
  const spawnBox = (scene, item, px, pz) => {
    const { width, height, depth } = item.dimensions;
    const mesh = MeshBuilder.CreateBox(item.id, { width, height, depth }, scene);
    // Position so the bottom of the box sits on the floor (y=0), clamped inside walls
    mesh.position.x = Math.max(-4.90 + width / 2, Math.min(4.90 - width / 2, px));
    mesh.position.y = height / 2;
    mesh.position.z = Math.max(-4.90 + depth / 2, Math.min(4.90 - depth / 2, pz));
    const uid = uidCounter.current++;
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });
    meshRegistryRef.current[uid] = mesh;
    const clamp = { halfW: width / 2, halfD: depth / 2 };
    rotClampRef.current[uid] = clamp;
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
      const newX = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, event.dragPlanePoint.x + grabOffsetX));
      const newZ = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, event.dragPlanePoint.z + grabOffsetZ));
      if (canMoveTo(mesh, newX, mesh.position.y, newZ)) {
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
      const result = await ImportMeshAsync(`${import.meta.env.BASE_URL}models/${item.id}.glb`, scene);

      // Walk up the parent chain from the first geometry mesh to find the true scene root
      // (the topmost ancestor with no parent). This is more reliable than searching
      // transformNodes, which may contain unrelated nodes in Babylon 8.x.
      let root = result.meshes[0];
      while (root.parent) root = root.parent;

      // Per-model rotation override (e.g. Y-up glTF models don't need the Z-up X correction).
      // Items can supply glbRotation: [x, y, z]; default assumes Z-up source.
      const [rx, ry, rz] = item.glbRotation ?? [-Math.PI / 2, -Math.PI / 2, 0];
      root.rotation = new Vector3(rx, ry, rz);
      root.position.set(px, 0, pz);

      // Force every mesh's world matrix to update with the new root orientation
      result.meshes.forEach((m) => m.computeWorldMatrix(true));

      // Helper: compute world AABB over all meshes
      const computeAABB = () => {
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
        return { minX, maxX, minY, maxY, minZ, maxZ };
      };

      // Compute the world AABB by iterating every visual mesh individually.
      // This is safer than getHierarchyBoundingVectors() which can miss meshes
      // if result.meshes[0] isn't actually the hierarchy root.
      let { minX, maxX, minY, maxY, minZ, maxZ } = computeAABB();

      // Auto-scale: if item.dimensions.width is specified, uniformly scale the model
      // so its world-space width matches. This handles models exported in cm/mm.
      if (item.dimensions?.width && (maxX - minX) > 0) {
        const sf = item.dimensions.width / (maxX - minX);
        root.scaling = new Vector3(sf, sf, sf);
        result.meshes.forEach((m) => m.computeWorldMatrix(true));
        ({ minX, maxX, minY, maxY, minZ, maxZ } = computeAABB());
      }

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
      // Centre the hitbox on the model's AABB centre (not the raw drop point).
      // If the model origin isn't at its geometric centre, using px would misalign the
      // hitbox and let geometry stick out past the clamped wall boundary.
      const modelCenterX = (minX + maxX) / 2;
      const modelCenterZ = (minZ + maxZ) / 2;
      const hitboxX = Math.max(-4.90 + (maxX - minX) / 2, Math.min(4.90 - (maxX - minX) / 2, modelCenterX));
      const hitboxZ = Math.max(-4.90 + (maxZ - minZ) / 2, Math.min(4.90 - (maxZ - minZ) / 2, modelCenterZ));
      hitbox.position.set(hitboxX, hitboxWorldY, hitboxZ);

      // Parent the model root to the hitbox so it moves atomically — no per-frame sync needed.
      // root.local keeps the model at its original world position (px, 0, pz).
      root.parent = hitbox;
      root.position.set(px - hitboxX, floorY - hitboxWorldY, pz - hitboxZ);

      // Only the hitbox should receive pointer events — sub-meshes would intercept clicks
      result.meshes.forEach((m) => { m.isPickable = false; });

      const uid = uidCounter.current++;
      addPlacedItem({ uid, id: item.id, label: item.label, modelType: "glb", x: px, z: pz });
      meshRegistryRef.current[uid] = hitbox;
      // Constrain dragging to the ground plane, same as box items
      const clamp = { halfW: (maxX - minX) / 2, halfD: (maxZ - minZ) / 2 };
      rotClampRef.current[uid] = clamp;
      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
      dragBehavior.moveAttached = false;
      let grabOffsetX = 0, grabOffsetZ = 0;
      dragBehavior.onDragStartObservable.add((event) => {
        grabOffsetX = hitbox.position.x - event.dragPlanePoint.x;
        grabOffsetZ = hitbox.position.z - event.dragPlanePoint.z;
      });
      dragBehavior.onDragObservable.add((event) => {
        const newX = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, event.dragPlanePoint.x + grabOffsetX));
        const newZ = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, event.dragPlanePoint.z + grabOffsetZ));
        if (canMoveTo(hitbox, newX, hitbox.position.y, newZ)) {
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

    const uid = uidCounter.current++;

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
          if (canMoveTo(mesh, newX, newY, wallZ)) {
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
          if (canMoveTo(mesh, wallX, newY, newZ)) {
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
        // Read final position from activeMesh (the live mesh after any wall snap) so the
        // saved coordinates reflect where the item actually landed, not the pre-snap position.
        updateItem(uid, {
          x: activeMesh.position.x, z: activeMesh.position.z, y: activeMesh.position.y,
          wall: nextWall ?? wall,
        });
      });

      mesh.addBehavior(dragBehavior);
    };

    buildOnWall(initialWall, pt.x, pt.z, spawnY);
  };

  // Spawns a detailed multi-mesh TV (screen, bezel, camera, LED, wall-mount bracket).
  // Uses an invisible hitbox so drag/collision logic is identical to spawnWallBox,
  // but all visual detail is built from child meshes parented to that hitbox.
  const spawnTV = (scene, item, pickResult) => {
    const W = item.dimensions.width;    // 1.6 — horizontal span
    const H = item.dimensions.height;   // 0.9 — vertical span
    const D = item.dimensions.depth;    // 0.05 — chassis thickness

    const pt      = pickResult.pickedPoint;
    const hitName = pickResult.pickedMesh?.name ?? "";

    let initialWall;
    if      (hitName === "wallBack")  initialWall = "back";
    else if (hitName === "wallLeft")  initialWall = "left";
    else if (hitName === "wallRight") initialWall = "right";
    else {
      const dBack  = Math.abs(pt.z + 5);
      const dLeft  = Math.abs(pt.x + 5);
      const dRight = Math.abs(pt.x - 5);
      if   (dBack <= dLeft && dBack <= dRight) initialWall = "back";
      else if (dLeft <= dRight)                initialWall = "left";
      else                                     initialWall = "right";
    }

    const spawnY = Math.max(H / 2, Math.min(5 - H / 2, pt.y > H / 2 ? pt.y : 2.0));
    const uid    = uidCounter.current++;

    let activeHitbox = null;
    let placed       = false;

    // Helper: create a material
    const mkMat = (name, r, g, b, sr = 0.06, sg = 0.06, sb = 0.08) => {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      return mat;
    };

    // Helper: box parented to hitbox
    const addBox = (hitbox, name, dims, lx, ly, lz, r, g, b, sr, sg, sb) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent     = hitbox;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      m.material   = mkMat(`${name}_mat`, r, g, b, sr, sg, sb);
      return m;
    };

    const buildOnWall = (wall, posX, posZ, posY) => {
      if (activeHitbox) {
        activeHitbox.getChildMeshes().forEach(m => m.dispose());
        activeHitbox.dispose();
      }

      let hitbox, dragNormal, lockFn;
      let grabOffsetA = 0, grabOffsetY = 0;

      // ── Back wall ────────────────────────────────────────────────────────────
      if (wall === "back") {
        const wallZ = -4.9;
        hitbox = MeshBuilder.CreateBox(`tv_${uid}`, { width: W, height: H, depth: D }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(Math.max(-5 + W / 2, Math.min(5 - W / 2, posX)), posY, wallZ);
        dragNormal = new Vector3(0, 0, 1);
        lockFn = (ev) => {
          const newX = Math.max(-5 + W / 2, Math.min(5 - W / 2, ev.dragPlanePoint.x + grabOffsetA));
          const newY = Math.max(H / 2, Math.min(5 - H / 2, ev.dragPlanePoint.y + grabOffsetY));
          if (canMoveTo(hitbox, newX, newY, wallZ)) {
            hitbox.position.x = newX;
            hitbox.position.y = newY;
          }
          grabOffsetA = hitbox.position.x - ev.dragPlanePoint.x;
          grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
          hitbox.position.z = wallZ;
        };

        // Front face is local +Z = D/2; all details protrude slightly past it
        const fz = D / 2;

        // Chassis body
        addBox(hitbox, `tv_body_${uid}`,   { width: W,       height: H,     depth: D },
          0, 0, 0,  0.06, 0.06, 0.08,  0.12, 0.12, 0.15);

        // Screen panel (inset from bezel edges)
        const sW = W - 0.10, sH = H - 0.12;
        addBox(hitbox, `tv_screen_${uid}`, { width: sW, height: sH, depth: 0.004 },
          0, 0.01, fz + 0.003,  0.04, 0.06, 0.16,  0.10, 0.16, 0.35);

        // Top bezel strip (houses camera)
        addBox(hitbox, `tv_bezel_top_${uid}`, { width: W, height: 0.055, depth: D + 0.002 },
          0, H / 2 - 0.028, 0,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);

        // Camera bump — tiny cylinder on top bezel, facing room
        const cam = MeshBuilder.CreateCylinder(`tv_cam_${uid}`,
          { diameter: 0.028, height: 0.009, tessellation: 16 }, scene);
        cam.parent    = hitbox;
        cam.rotation.x = Math.PI / 2;
        cam.position.set(0, H / 2 - 0.028, fz + 0.005);
        cam.isPickable = false;
        cam.material   = mkMat(`tv_cam_mat_${uid}`, 0.12, 0.12, 0.14, 0.22, 0.22, 0.26);

        // Camera lens (darker inner dot)
        const lens = MeshBuilder.CreateCylinder(`tv_lens_${uid}`,
          { diameter: 0.014, height: 0.010, tessellation: 16 }, scene);
          
        lens.parent    = hitbox;
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, H / 2 - 0.028, fz + 0.009);
        lens.isPickable = false;
        lens.material   = mkMat(`tv_lens_mat_${uid}`, 0.04, 0.04, 0.06, 0.30, 0.30, 0.35);
        
        // Bottom bezel strip
        addBox(hitbox, `tv_bezel_bot_${uid}`, { width: W, height: 0.042, depth: D + 0.002 },
          0, -H / 2 + 0.021, 0,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);

        // Power LED — tiny blue rect on bottom bezel
        addBox(hitbox, `tv_led_${uid}`, { width: 0.026, height: 0.014, depth: 0.007 },
          0, -H / 2 + 0.021, fz + 0.004,  0.08, 0.36, 1.0,  0.10, 0.44, 1.0);

        // Side bezels (left & right slim strips)
        [-W / 2 + 0.025, W / 2 - 0.025].forEach((bx, i) => {
          addBox(hitbox, `tv_bezel_side_${i}_${uid}`, { width: 0.050, height: H, depth: D + 0.002 },
            bx, 0, 0,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);
        });

        // Wall-mount bracket (slim horizontal bar on the back)
        addBox(hitbox, `tv_mount_${uid}`, { width: W * 0.50, height: 0.055, depth: 0.025 },
          0, 0, -D / 2 - 0.013,  0.16, 0.16, 0.18,  0.20, 0.20, 0.22);

      // ── Side walls ───────────────────────────────────────────────────────────
      } else {
        const wallX = wall === "left" ? -4.9 : 4.9;
        const sign  = wall === "left" ? 1 : -1;   // +1 = room is toward +X, -1 toward -X

        // Swap width↔depth so the TV spans Z and is thin in X (no mesh rotation needed)
        hitbox = MeshBuilder.CreateBox(`tv_${uid}`, { width: D, height: H, depth: W }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(wallX, posY, Math.max(-5 + W / 2, Math.min(5 - W / 2, posZ)));
        dragNormal = wall === "left" ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
        lockFn = (ev) => {
          const newZ = Math.max(-5 + W / 2, Math.min(5 - W / 2, ev.dragPlanePoint.z + grabOffsetA));
          const newY = Math.max(H / 2, Math.min(5 - H / 2, ev.dragPlanePoint.y + grabOffsetY));
          if (canMoveTo(hitbox, wallX, newY, newZ)) {
            hitbox.position.z = newZ;
            hitbox.position.y = newY;
          }
          grabOffsetA = hitbox.position.z - ev.dragPlanePoint.z;
          grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
          hitbox.position.x = wallX;
        };

        // Front face is local sign*(D/2); details protrude slightly past it
        const fx = sign * (D / 2);

        // Chassis body
        addBox(hitbox, `tv_body_${uid}`, { width: D, height: H, depth: W },
          0, 0, 0,  0.06, 0.06, 0.08,  0.12, 0.12, 0.15);

        // Screen panel
        const sH = H - 0.12, sZ = W - 0.10;
        addBox(hitbox, `tv_screen_${uid}`, { width: 0.004, height: sH, depth: sZ },
          fx + sign * 0.003, 0.01, 0,  0.04, 0.06, 0.16,  0.10, 0.16, 0.35);

        // Top bezel
        addBox(hitbox, `tv_bezel_top_${uid}`, { width: D + 0.002, height: 0.055, depth: W },
          0, H / 2 - 0.028, 0,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);

        // Camera bump
        const cam = MeshBuilder.CreateCylinder(`tv_cam_${uid}`,
          { diameter: 0.028, height: 0.009, tessellation: 16 }, scene);
        cam.parent    = hitbox;
        cam.rotation.z = Math.PI / 2;    // axis points along X (toward room)
        cam.position.set(fx + sign * 0.005, H / 2 - 0.028, 0);
        cam.isPickable = false;
        cam.material   = mkMat(`tv_cam_mat_${uid}`, 0.12, 0.12, 0.14, 0.22, 0.22, 0.26);

        // Camera lens
        const lens = MeshBuilder.CreateCylinder(`tv_lens_${uid}`,
          { diameter: 0.014, height: 0.010, tessellation: 16 }, scene);
        lens.parent    = hitbox;
        lens.rotation.z = Math.PI / 2;
        lens.position.set(fx + sign * 0.009, H / 2 - 0.028, 0);
        lens.isPickable = false;
        lens.material   = mkMat(`tv_lens_mat_${uid}`, 0.04, 0.04, 0.06, 0.30, 0.30, 0.35);

        // Bottom bezel
        addBox(hitbox, `tv_bezel_bot_${uid}`, { width: D + 0.002, height: 0.042, depth: W },
          0, -H / 2 + 0.021, 0,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);

        // Power LED
        addBox(hitbox, `tv_led_${uid}`, { width: 0.007, height: 0.014, depth: 0.026 },
          fx + sign * 0.004, -H / 2 + 0.021, 0,  0.08, 0.36, 1.0,  0.10, 0.44, 1.0);

        // Side bezels (top/bottom of TV span — these are along Z for side walls)
        [-W / 2 + 0.025, W / 2 - 0.025].forEach((bz, i) => {
          addBox(hitbox, `tv_bezel_side_${i}_${uid}`, { width: D + 0.002, height: H, depth: 0.050 },
            0, 0, bz,  0.05, 0.05, 0.07,  0.08, 0.08, 0.10);
        });

        // Wall-mount bracket
        addBox(hitbox, `tv_mount_${uid}`, { width: 0.025, height: 0.055, depth: W * 0.50 },
          -sign * (D / 2 + 0.013), 0, 0,  0.16, 0.16, 0.18,  0.20, 0.20, 0.22);
      }

      activeHitbox = hitbox;
      meshRegistryRef.current[uid] = hitbox;

      if (!placed) {
        placed = true;
        addPlacedItem({
          uid, id: item.id, label: item.label, modelType: "wall",
          x: hitbox.position.x, z: hitbox.position.z, y: hitbox.position.y, wall,
        });
      }

      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: dragNormal });
      dragBehavior.moveAttached = false;
      dragBehavior.onDragStartObservable.add((ev) => {
        grabOffsetA = wall === "back"
          ? hitbox.position.x - ev.dragPlanePoint.x
          : hitbox.position.z - ev.dragPlanePoint.z;
        grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
      });
      dragBehavior.onDragObservable.add(lockFn);
      dragBehavior.onDragEndObservable.add(() => {
        const x = hitbox.position.x, y = hitbox.position.y, z = hitbox.position.z;
        let nextWall = null;
        if (wall === "back") {
          if (x < -2.5) nextWall = "left";
          else if (x > 2.5) nextWall = "right";
        } else {
          if (z < -2.5) nextWall = "back";
        }
        if (nextWall) buildOnWall(nextWall, x, z, y);
        updateItem(uid, {
          x: activeHitbox.position.x, z: activeHitbox.position.z, y: activeHitbox.position.y,
          wall: nextWall ?? wall,
        });
      });
      hitbox.addBehavior(dragBehavior);
    };

    buildOnWall(initialWall, pt.x, pt.z, spawnY);
  };

  // Spawns a detailed multi-mesh bed (frame, headboard, footboard, legs, mattress, blanket, pillows).
  // All visual meshes are parented to an invisible hitbox that handles collision and drag.
  const spawnBed = (scene, item, px, pz) => {
    const W   = 2.8;    // overall width  (X)
    const D   = 4.0;    // overall depth  (Z)
    const hbH = 1.05;   // headboard height = bounding-box height

    const uid = uidCounter.current++;
    const hitbox = MeshBuilder.CreateBox(`bed_${uid}`, { width: W, height: hbH, depth: D }, scene);
    hitbox.visibility = 0;
    // Clamp initial position: +0.03 accounts for headboard/footboard overhang beyond the hitbox
    hitbox.position.set(
      Math.max(-4.90 + W / 2 + 0.03, Math.min(4.90 - W / 2 - 0.03, px)),
      hbH / 2,
      Math.max(-4.90 + D / 2, Math.min(4.90 - D / 2, pz))
    );
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
    const legR = 0.06, legH = 0.34;
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
    const plW = W / 2 - 0.16;
    const plD = 0.70;
    const plH = 0.10;
    const plZ = mZ - mD / 2 + 0.05 + plD / 2;   // near the headboard end

    [-W / 4 + 0.03, W / 4 - 0.03].forEach((plX, i) => {
      addBox(`bed_pillow_${i}`, { width: plW, height: plH, depth: plD },
        plX, wly(mTop + plH / 2), plZ,
        0.97, 0.96, 0.92, 0.06, 0.06, 0.06);
    });

    // ── Drag behaviour on hitbox ─────────────────────────────────────────
    // halfW includes the 0.03 m overhang of headboard/footboard beyond the hitbox
    const clamp = { halfW: W / 2 + 0.03, halfD: D / 2 };
    rotClampRef.current[uid] = clamp;
    const drag = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    drag.moveAttached = false;
    let grabX = 0, grabZ = 0;
    drag.onDragStartObservable.add((ev) => {
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragObservable.add((ev) => {
      const nx = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, ev.dragPlanePoint.x + grabX));
      const nz = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, ev.dragPlanePoint.z + grabZ));
      if (canMoveTo(hitbox, nx, hitbox.position.y, nz)) {
        hitbox.position.x = nx;
        hitbox.position.z = nz;
      }
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragEndObservable.add(() => updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }));
    hitbox.addBehavior(drag);
  };

  // Spawns a detailed multi-mesh desk (slab, four steel legs, right-hand drawer pedestal).
  const spawnDesk = (scene, item, px, pz) => {
    const W     = 2.2;    // overall width  (X)
    const D     = 1.0;    // overall depth  (Z)
    const topH  = 0.76;   // desk surface height = hitbox height
    const slabT = 0.05;   // desktop slab thickness

    const uid = uidCounter.current++;
    const hitbox = MeshBuilder.CreateBox(`desk_${uid}`, { width: W, height: topH, depth: D }, scene);
    hitbox.visibility = 0;
    // Clamp initial position: +0.02 accounts for desktop slab overhang beyond the hitbox
    hitbox.position.set(
      Math.max(-4.90 + W / 2 + 0.02, Math.min(4.90 - W / 2 - 0.02, px)),
      topH / 2,
      Math.max(-4.90 + D / 2 + 0.02, Math.min(4.90 - D / 2 - 0.02, pz))
    );
    meshRegistryRef.current[uid] = hitbox;
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });

    const wly = (wy) => wy - topH / 2;

    const addBox = (name, dims, lx, ly, lz, r, g, b, sr = 0.08, sg = 0.07, sb = 0.04) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent = hitbox;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      const mat = new StandardMaterial(`${name}_mat`, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      m.material = mat;
      return m;
    };

    // ── Desktop slab (slight overhang on all sides) ───────────────────────
    addBox(`desk_top_${uid}`, { width: W + 0.04, height: slabT, depth: D + 0.04 },
      0, wly(topH - slabT / 2), 0,
      0.72, 0.54, 0.30,  0.14, 0.11, 0.06);

    // ── Four slim steel legs ──────────────────────────────────────────────
    const legW  = 0.07, legD = 0.07;
    const legH  = topH - slabT;
    const inset = 0.10;
    [
      [-(W / 2 - inset), -(D / 2 - inset)],
      [ (W / 2 - inset), -(D / 2 - inset)],
      [-(W / 2 - inset),  (D / 2 - inset)],
      [ (W / 2 - inset),  (D / 2 - inset)],
    ].forEach(([lx, lz], i) =>
      addBox(`desk_leg_${i}_${uid}`, { width: legW, height: legH, depth: legD },
        lx, wly(legH / 2), lz,
        0.24, 0.24, 0.26,  0.32, 0.32, 0.36));

    // ── Right-hand drawer pedestal ────────────────────────────────────────
    const dW     = 0.44;          // pedestal width
    const dD     = D - 0.12;      // pedestal depth (inset from front + back)
    const dFloor = 0.06;          // clearance above floor
    const dH     = legH - dFloor; // pedestal height
    const dX     = W / 2 - inset - dW / 2;  // centred on right-leg line

    // Carcass
    addBox(`desk_ped_${uid}`, { width: dW, height: dH, depth: dD },
      dX, wly(dFloor + dH / 2), 0,
      0.62, 0.46, 0.27,  0.08, 0.07, 0.04);

    // 3 drawer fronts + handles
    const numDrawers = 3;
    const dfH = (dH - 0.04) / numDrawers;
    for (let i = 0; i < numDrawers; i++) {
      const dfY = dFloor + 0.02 + dfH / 2 + i * dfH;
      addBox(`desk_df_${i}_${uid}`, { width: dW - 0.025, height: dfH - 0.018, depth: 0.016 },
        dX, wly(dfY), dD / 2 + 0.009,
        0.70, 0.52, 0.30,  0.12, 0.10, 0.06);
      // Metal handle bar
      addBox(`desk_dh_${i}_${uid}`, { width: 0.12, height: 0.013, depth: 0.020 },
        dX, wly(dfY), dD / 2 + 0.018,
        0.52, 0.52, 0.55,  0.42, 0.42, 0.46);
    }

    // ── Drag behaviour ────────────────────────────────────────────────────
    // halfW/halfD include the 0.02 m overhang of the desktop slab beyond the hitbox
    const clamp = { halfW: W / 2 + 0.02, halfD: D / 2 + 0.02 };
    rotClampRef.current[uid] = clamp;
    const drag = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    drag.moveAttached = false;
    let grabX = 0, grabZ = 0;
    drag.onDragStartObservable.add((ev) => {
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragObservable.add((ev) => {
      const nx = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, ev.dragPlanePoint.x + grabX));
      const nz = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, ev.dragPlanePoint.z + grabZ));
      if (canMoveTo(hitbox, nx, hitbox.position.y, nz)) {
        hitbox.position.x = nx;
        hitbox.position.z = nz;
      }
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragEndObservable.add(() => updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }));
    hitbox.addBehavior(drag);
  };

  // Spawns a desk chair — steel legs, wood seat frame, dark fabric cushions + backrest.
  const spawnChair = (scene, item, px, pz) => {
    const W     = 0.58;   // overall width  (X)
    const D     = 0.55;   // overall depth  (Z)
    const seatH = 0.46;   // world Y of seat top surface
    const seatT = 0.07;   // seat frame thickness
    const legH  = seatH - seatT;   // 0.39
    const backH = 0.42;   // backrest height above seat
    const hbH   = seatH + backH;   // hitbox height = 0.88

    const uid = uidCounter.current++;
    const hitbox = MeshBuilder.CreateBox(`chair_${uid}`, { width: W, height: hbH, depth: D }, scene);
    hitbox.visibility = 0;
    hitbox.position.set(
      Math.max(-4.90 + W / 2, Math.min(4.90 - W / 2, px)),
      hbH / 2,
      Math.max(-4.90 + D / 2, Math.min(4.90 - D / 2, pz))
    );
    meshRegistryRef.current[uid] = hitbox;
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });

    const wly = (wy) => wy - hbH / 2;

    const addBox = (name, dims, lx, ly, lz, r, g, b, sr = 0.08, sg = 0.08, sb = 0.09) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent = hitbox;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      const mat = new StandardMaterial(`${name}_mat`, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      m.material = mat;
      return m;
    };

    // ── Four slim steel legs ──────────────────────────────────────────────
    const lw = 0.05, inset = 0.07;
    [
      [-(W / 2 - inset), -(D / 2 - inset)],
      [ (W / 2 - inset), -(D / 2 - inset)],
      [-(W / 2 - inset),  (D / 2 - inset)],
      [ (W / 2 - inset),  (D / 2 - inset)],
    ].forEach(([lx, lz], i) =>
      addBox(`chair_leg_${i}_${uid}`, { width: lw, height: legH, depth: lw },
        lx, wly(legH / 2), lz,
        0.24, 0.24, 0.26,  0.32, 0.32, 0.36));

    // Thin cross-brace connecting the two front legs and the two back legs
    const braceY = legH * 0.38;
    [-(D / 2 - inset), (D / 2 - inset)].forEach((bz, i) =>
      addBox(`chair_brace_${i}_${uid}`, { width: W - 2 * inset, height: 0.025, depth: lw },
        0, wly(braceY), bz,
        0.24, 0.24, 0.26,  0.32, 0.32, 0.36));

    // ── Seat frame (wood, matches desk top) ──────────────────────────────
    addBox(`chair_seat_frame_${uid}`, { width: W, height: seatT, depth: D },
      0, wly(seatH - seatT / 2), 0,
      0.72, 0.54, 0.30,  0.14, 0.11, 0.06);

    // ── Seat cushion (dark fabric) ────────────────────────────────────────
    addBox(`chair_seat_cushion_${uid}`, { width: W - 0.08, height: 0.055, depth: D - 0.08 },
      0, wly(seatH + 0.028), 0,
      0.22, 0.22, 0.25,  0.04, 0.04, 0.05);

    // ── Backrest uprights (two steel posts) ───────────────────────────────
    const backZ  = +(D / 2 - inset);   // local Z of backrest (front edge, facing room)
    const postH  = backH + seatT;
    [-W / 4 + 0.02, W / 4 - 0.02].forEach((bx, i) =>
      addBox(`chair_post_${i}_${uid}`, { width: lw, height: postH, depth: lw },
        bx, wly(seatH - seatT + postH / 2), backZ,
        0.24, 0.24, 0.26,  0.32, 0.32, 0.36));

    // ── Backrest cushion (fabric pad between the uprights) ────────────────
    addBox(`chair_back_cushion_${uid}`, { width: W - 0.14, height: backH - 0.04, depth: 0.07 },
      0, wly(seatH + (backH - 0.04) / 2 + 0.02), backZ - 0.04,
      0.22, 0.22, 0.25,  0.04, 0.04, 0.05);

    // ── Drag behaviour ────────────────────────────────────────────────────
    const clamp = { halfW: W / 2, halfD: D / 2 };
    rotClampRef.current[uid] = clamp;
    const drag = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    drag.moveAttached = false;
    let grabX = 0, grabZ = 0;
    drag.onDragStartObservable.add((ev) => {
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragObservable.add((ev) => {
      const nx = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, ev.dragPlanePoint.x + grabX));
      const nz = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, ev.dragPlanePoint.z + grabZ));
      if (canMoveTo(hitbox, nx, hitbox.position.y, nz)) {
        hitbox.position.x = nx;
        hitbox.position.z = nz;
      }
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragEndObservable.add(() => updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }));
    hitbox.addBehavior(drag);
  };

  // Spawns a 3-seater couch — dark wood legs/base/back panel, charcoal-blue fabric armrests,
  // seat cushions, and back cushions.
  const spawnCouch = (scene, item, px, pz) => {
    const W        = 2.0;
    const D        = 0.90;
    const legH     = 0.14;
    const legW     = 0.06;
    const baseH    = 0.22;
    const cushionH = 0.12;
    const seatH    = legH + baseH + cushionH;  // 0.48
    const armW     = 0.16;
    const armH     = 0.64;
    const backT    = 0.20;
    const backTopY = 0.90;
    const hbH      = backTopY;

    const uid = uidCounter.current++;
    const hitbox = MeshBuilder.CreateBox(`couch_${uid}`, { width: W, height: hbH, depth: D }, scene);
    hitbox.visibility = 0;
    hitbox.position.set(
      Math.max(-4.90 + W / 2, Math.min(4.90 - W / 2, px)),
      hbH / 2,
      Math.max(-4.90 + D / 2, Math.min(4.90 - D / 2, pz))
    );
    meshRegistryRef.current[uid] = hitbox;
    addPlacedItem({ uid, id: item.id, label: item.label, modelType: "box", x: px, z: pz });

    const wly = (wy) => wy - hbH / 2;

    const addBox = (name, dims, lx, ly, lz, r, g, b, sr = 0.05, sg = 0.05, sb = 0.06) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent = hitbox;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      const mat = new StandardMaterial(`${name}_mat`, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      m.material = mat;
      return m;
    };

    // ── 4 short wooden legs ──────────────────────────────────────────────
    const inset = 0.12;
    [
      [-(W / 2 - inset), -(D / 2 - inset)],
      [ (W / 2 - inset), -(D / 2 - inset)],
      [-(W / 2 - inset),  (D / 2 - inset)],
      [ (W / 2 - inset),  (D / 2 - inset)],
    ].forEach(([lx, lz], i) =>
      addBox(`couch_leg_${i}_${uid}`, { width: legW, height: legH, depth: legW },
        lx, wly(legH / 2), lz,
        0.22, 0.15, 0.08));

    // ── Solid base ────────────────────────────────────────────────────────
    addBox(`couch_base_${uid}`, { width: W, height: baseH, depth: D },
      0, wly(legH + baseH / 2), 0,
      0.22, 0.15, 0.08);

    // ── Back panel (structural dark wood) ─────────────────────────────────
    const backPanelH = backTopY - legH;
    const backZ      = D / 2 - backT / 2;
    addBox(`couch_backpanel_${uid}`, { width: W, height: backPanelH, depth: backT },
      0, wly(legH + backPanelH / 2), backZ,
      0.22, 0.15, 0.08);

    // ── 2 Armrests ────────────────────────────────────────────────────────
    [-(W / 2 - armW / 2), (W / 2 - armW / 2)].forEach((ax, i) =>
      addBox(`couch_arm_${i}_${uid}`, { width: armW, height: armH, depth: D },
        ax, wly(armH / 2), 0,
        0.28, 0.30, 0.36));

    // ── 3 Seat cushions ───────────────────────────────────────────────────
    const seatAreaW = W - 2 * armW;
    const cW        = (seatAreaW - 0.06) / 3;
    const cStep     = cW + 0.02;
    const cx0       = -(seatAreaW / 2) + 0.01 + cW / 2;
    const cD        = D - backT - 0.06;
    const seatCZ    = -(backT - 0.01) / 2;
    for (let i = 0; i < 3; i++) {
      addBox(`couch_seatc_${i}_${uid}`, { width: cW - 0.02, height: cushionH, depth: cD },
        cx0 + i * cStep, wly(legH + baseH + cushionH / 2), seatCZ,
        0.28, 0.30, 0.36);
    }

    // ── 3 Back cushions ───────────────────────────────────────────────────
    const bckD  = 0.10;
    const bckH  = backTopY - seatH - 0.06;
    const bckCZ = D / 2 - backT - bckD / 2;
    for (let i = 0; i < 3; i++) {
      addBox(`couch_backc_${i}_${uid}`, { width: cW - 0.02, height: bckH, depth: bckD },
        cx0 + i * cStep, wly(seatH + 0.02 + bckH / 2), bckCZ,
        0.32, 0.34, 0.40);
    }

    // ── Drag behaviour ────────────────────────────────────────────────────
    const clamp = { halfW: W / 2, halfD: D / 2 };
    rotClampRef.current[uid] = clamp;
    const drag = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    drag.moveAttached = false;
    let grabX = 0, grabZ = 0;
    drag.onDragStartObservable.add((ev) => {
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragObservable.add((ev) => {
      const nx = Math.max(-4.90 + clamp.halfW, Math.min(4.90 - clamp.halfW, ev.dragPlanePoint.x + grabX));
      const nz = Math.max(-4.90 + clamp.halfD, Math.min(4.90 - clamp.halfD, ev.dragPlanePoint.z + grabZ));
      if (canMoveTo(hitbox, nx, hitbox.position.y, nz)) {
        hitbox.position.x = nx;
        hitbox.position.z = nz;
      }
      grabX = hitbox.position.x - ev.dragPlanePoint.x;
      grabZ = hitbox.position.z - ev.dragPlanePoint.z;
    });
    drag.onDragEndObservable.add(() => updateItem(uid, { x: hitbox.position.x, z: hitbox.position.z }));
    hitbox.addBehavior(drag);
  };

  // Spawns a wall-mounted window with frame, glass pane and cross dividers.
  // Identical wall-snap / drag behaviour to the TV.
  const spawnWindow = (scene, item, pickResult) => {
    const W  = item.dimensions.width;   // 1.4
    const H  = item.dimensions.height;  // 1.2
    const D  = item.dimensions.depth;   // 0.12
    const fT = 0.07;   // frame border thickness

    const pt      = pickResult.pickedPoint;
    const hitName = pickResult.pickedMesh?.name ?? "";

    let initialWall;
    if      (hitName === "wallBack")  initialWall = "back";
    else if (hitName === "wallLeft")  initialWall = "left";
    else if (hitName === "wallRight") initialWall = "right";
    else {
      const dBack  = Math.abs(pt.z + 5);
      const dLeft  = Math.abs(pt.x + 5);
      const dRight = Math.abs(pt.x - 5);
      if   (dBack <= dLeft && dBack <= dRight) initialWall = "back";
      else if (dLeft <= dRight)                initialWall = "left";
      else                                     initialWall = "right";
    }

    const spawnY = Math.max(H / 2, Math.min(5 - H / 2, pt.y > H / 2 ? pt.y : 2.2));
    const uid    = uidCounter.current++;

    let activeHitbox = null;
    let placed       = false;

    const mkMat = (name, r, g, b, alpha = 1, sr = 0.05, sg = 0.05, sb = 0.05) => {
      const mat = new StandardMaterial(name, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      if (alpha < 1) { mat.alpha = alpha; }
      return mat;
    };

    const addBox = (parent, name, dims, lx, ly, lz, r, g, b, alpha = 1) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent     = parent;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      m.material   = mkMat(`${name}_mat`, r, g, b, alpha);
      return m;
    };

    // Builds 4 frame strips + glass + cross dividers parented to hitbox.
    // fx/fy/fz describe the offset direction toward the room face.
    const addWindowDetail = (hitbox, wall) => {
      const frameCol  = [0.88, 0.86, 0.82];   // warm white frame
      const divT      = 0.035;                 // cross-divider thickness

      if (wall === "back") {
        const fz = D / 2;   // front face local Z
        // Frame strips
        addBox(hitbox, `win_top_${uid}`,    { width: W,       height: fT,      depth: D }, 0,  H/2 - fT/2, 0, ...frameCol);
        addBox(hitbox, `win_bot_${uid}`,    { width: W,       height: fT,      depth: D }, 0, -H/2 + fT/2, 0, ...frameCol);
        addBox(hitbox, `win_left_${uid}`,   { width: fT,      height: H-2*fT,  depth: D }, -W/2+fT/2, 0, 0, ...frameCol);
        addBox(hitbox, `win_right_${uid}`,  { width: fT,      height: H-2*fT,  depth: D },  W/2-fT/2, 0, 0, ...frameCol);
        // Glass pane
        addBox(hitbox, `win_glass_${uid}`,  { width: W-2*fT,  height: H-2*fT,  depth: 0.008 }, 0, 0, fz+0.001, 0.72, 0.86, 0.95, 0.35);
        // Cross dividers
        addBox(hitbox, `win_div_h_${uid}`,  { width: W-2*fT,  height: divT,    depth: 0.012 }, 0, 0, fz+0.003, ...frameCol);
        addBox(hitbox, `win_div_v_${uid}`,  { width: divT,    height: H-2*fT,  depth: 0.012 }, 0, 0, fz+0.003, ...frameCol);
      } else {
        const sign = wall === "left" ? 1 : -1;
        const fx   = sign * D / 2;
        // Frame strips
        addBox(hitbox, `win_top_${uid}`,    { width: D,       height: fT,      depth: W }, 0,  H/2 - fT/2, 0, ...frameCol);
        addBox(hitbox, `win_bot_${uid}`,    { width: D,       height: fT,      depth: W }, 0, -H/2 + fT/2, 0, ...frameCol);
        addBox(hitbox, `win_left_${uid}`,   { width: D,       height: H-2*fT,  depth: fT }, 0, 0, -W/2+fT/2, ...frameCol);
        addBox(hitbox, `win_right_${uid}`,  { width: D,       height: H-2*fT,  depth: fT }, 0, 0,  W/2-fT/2, ...frameCol);
        // Glass pane
        addBox(hitbox, `win_glass_${uid}`,  { width: 0.008,   height: H-2*fT,  depth: W-2*fT }, fx+sign*0.001, 0, 0, 0.72, 0.86, 0.95, 0.35);
        // Cross dividers
        addBox(hitbox, `win_div_h_${uid}`,  { width: 0.012,   height: divT,    depth: W-2*fT }, fx+sign*0.003, 0, 0, ...frameCol);
        addBox(hitbox, `win_div_v_${uid}`,  { width: 0.012,   height: H-2*fT,  depth: divT   }, fx+sign*0.003, 0, 0, ...frameCol);
      }
    };

    const buildOnWall = (wall, posX, posZ, posY) => {
      if (activeHitbox) {
        activeHitbox.getChildMeshes().forEach(m => m.dispose());
        activeHitbox.dispose();
      }

      let hitbox, dragNormal, lockFn;
      let grabOffsetA = 0, grabOffsetY = 0;

      if (wall === "back") {
        const wallZ = -4.9;
        hitbox = MeshBuilder.CreateBox(`win_${uid}`, { width: W, height: H, depth: D }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(Math.max(-5 + W/2, Math.min(5 - W/2, posX)), posY, wallZ);
        dragNormal = new Vector3(0, 0, 1);
        lockFn = (ev) => {
          const newX = Math.max(-5 + W/2, Math.min(5 - W/2, ev.dragPlanePoint.x + grabOffsetA));
          const newY = Math.max(H/2, Math.min(5 - H/2, ev.dragPlanePoint.y + grabOffsetY));
          if (canMoveTo(hitbox, newX, newY, wallZ)) { hitbox.position.x = newX; hitbox.position.y = newY; }
          grabOffsetA = hitbox.position.x - ev.dragPlanePoint.x;
          grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
          hitbox.position.z = wallZ;
        };
      } else {
        const wallX = wall === "left" ? -4.9 : 4.9;
        hitbox = MeshBuilder.CreateBox(`win_${uid}`, { width: D, height: H, depth: W }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(wallX, posY, Math.max(-5 + W/2, Math.min(5 - W/2, posZ)));
        dragNormal = wall === "left" ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
        lockFn = (ev) => {
          const newZ = Math.max(-5 + W/2, Math.min(5 - W/2, ev.dragPlanePoint.z + grabOffsetA));
          const newY = Math.max(H/2, Math.min(5 - H/2, ev.dragPlanePoint.y + grabOffsetY));
          if (canMoveTo(hitbox, wallX, newY, newZ)) { hitbox.position.z = newZ; hitbox.position.y = newY; }
          grabOffsetA = hitbox.position.z - ev.dragPlanePoint.z;
          grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
          hitbox.position.x = wallX;
        };
      }

      addWindowDetail(hitbox, wall);
      activeHitbox = hitbox;
      meshRegistryRef.current[uid] = hitbox;

      if (!placed) {
        placed = true;
        addPlacedItem({
          uid, id: item.id, label: item.label, modelType: "wall",
          x: hitbox.position.x, z: hitbox.position.z, y: hitbox.position.y, wall,
        });
      }

      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: dragNormal });
      dragBehavior.moveAttached = false;
      dragBehavior.onDragStartObservable.add((ev) => {
        grabOffsetA = wall === "back"
          ? hitbox.position.x - ev.dragPlanePoint.x
          : hitbox.position.z - ev.dragPlanePoint.z;
        grabOffsetY = hitbox.position.y - ev.dragPlanePoint.y;
      });
      dragBehavior.onDragObservable.add(lockFn);
      dragBehavior.onDragEndObservable.add(() => {
        const x = hitbox.position.x, y = hitbox.position.y, z = hitbox.position.z;
        let nextWall = null;
        if (wall === "back") {
          if (x < -2.5) nextWall = "left";
          else if (x > 2.5) nextWall = "right";
        } else {
          if (z < -2.5) nextWall = "back";
        }
        if (nextWall) buildOnWall(nextWall, x, z, y);
        updateItem(uid, {
          x: activeHitbox.position.x, z: activeHitbox.position.z, y: activeHitbox.position.y,
          wall: nextWall ?? wall,
        });
      });
      hitbox.addBehavior(dragBehavior);
    };

    buildOnWall(initialWall, pt.x, pt.z, spawnY);
  };

  // Spawns a wall-mounted door: frame + slab + two raised panels + handle.
  // Y is always locked to floor level — the door never floats.
  const spawnDoor = (scene, item, pickResult) => {
    const W  = item.dimensions.width;   // 0.9
    const H  = item.dimensions.height;  // 2.1
    const D  = item.dimensions.depth;   // 0.10
    const fT = 0.08;   // frame border thickness

    const pt      = pickResult.pickedPoint;
    const hitName = pickResult.pickedMesh?.name ?? "";

    let initialWall;
    if      (hitName === "wallBack")  initialWall = "back";
    else if (hitName === "wallLeft")  initialWall = "left";
    else if (hitName === "wallRight") initialWall = "right";
    else {
      const dBack  = Math.abs(pt.z + 5);
      const dLeft  = Math.abs(pt.x + 5);
      const dRight = Math.abs(pt.x - 5);
      if   (dBack <= dLeft && dBack <= dRight) initialWall = "back";
      else if (dLeft <= dRight)                initialWall = "left";
      else                                     initialWall = "right";
    }

    // Door always sits on the floor
    const spawnY = H / 2;
    const uid    = uidCounter.current++;

    let activeHitbox = null;
    let placed       = false;

    const addBox = (parent, name, dims, lx, ly, lz, r, g, b, sr = 0.06, sg = 0.05, sb = 0.03) => {
      const m = MeshBuilder.CreateBox(name, dims, scene);
      m.parent = parent;
      m.position.set(lx, ly, lz);
      m.isPickable = false;
      const mat = new StandardMaterial(`${name}_mat`, scene);
      mat.diffuseColor  = new Color3(r, g, b);
      mat.specularColor = new Color3(sr, sg, sb);
      m.material = mat;
      return m;
    };

    const addDoorDetail = (hitbox, wall) => {
      // Shared dimensions
      const slabW = W - 2 * fT;          // 0.74  — door slab width
      const slabH = H - fT;              // 2.02  — door slab height
      const slabT = 0.036;               // slab thickness (proud of frame)
      const jamCY = -fT / 2;             // Y centre of left/right jambs

      // Panel layout (two panels split by a mid-rail) — all relative to H
      const midRailH = 0.05;
      const midRailY = 0.00;
      const pW       = slabW - 0.12;
      const upPH  = H / 2 - 0.245;   const upPY  =  H / 4 - 0.028;
      const loPH  = H / 2 - 0.165;   const loPY  = -H / 4 - 0.013;

      if (wall === "back") {
        const fz = D / 2;

        // Frame — top + left + right (no bottom: door reaches the floor)
        addBox(hitbox, `door_top_${uid}`,   { width: W,    height: fT,     depth: D }, 0,           H/2-fT/2, 0, 0.86, 0.83, 0.78);
        addBox(hitbox, `door_ljamb_${uid}`, { width: fT,   height: slabH,  depth: D }, -W/2+fT/2,  jamCY,    0, 0.86, 0.83, 0.78);
        addBox(hitbox, `door_rjamb_${uid}`, { width: fT,   height: slabH,  depth: D },  W/2-fT/2,  jamCY,    0, 0.86, 0.83, 0.78);

        // Door slab
        addBox(hitbox, `door_slab_${uid}`,  { width: slabW, height: slabH, depth: slabT },
          0, jamCY, fz - slabT/2 + 0.008,  0.62, 0.46, 0.27);

        // Mid rail
        addBox(hitbox, `door_midrail_${uid}`, { width: slabW, height: midRailH, depth: slabT+0.006 },
          0, midRailY, fz - slabT/2 + 0.011,  0.56, 0.41, 0.23);

        // Raised panels
        addBox(hitbox, `door_panel_up_${uid}`, { width: pW, height: upPH, depth: 0.014 },
          0, upPY, fz + 0.010,  0.70, 0.53, 0.30,  0.10, 0.08, 0.05);
        addBox(hitbox, `door_panel_lo_${uid}`, { width: pW, height: loPH, depth: 0.014 },
          0, loPY, fz + 0.010,  0.70, 0.53, 0.30,  0.10, 0.08, 0.05);

        // Handle backplate + knob (handle-side = right)
        const hx = slabW / 2 - 0.09;
        addBox(hitbox, `door_plate_${uid}`, { width: 0.038, height: 0.13, depth: 0.016 },
          hx, midRailY, fz + 0.018,  0.72, 0.60, 0.22,  0.50, 0.42, 0.15);
        const knob = MeshBuilder.CreateCylinder(`door_knob_${uid}`,
          { diameter: 0.038, height: 0.055, tessellation: 16 }, scene);
        knob.parent    = hitbox;
        knob.rotation.x = Math.PI / 2;
        knob.position.set(hx, midRailY, fz + 0.046);
        knob.isPickable = false;
        const km = new StandardMaterial(`door_knob_mat_${uid}`, scene);
        km.diffuseColor  = new Color3(0.78, 0.64, 0.20);
        km.specularColor = new Color3(0.62, 0.52, 0.16);
        knob.material = km;

      } else {
        // Side walls — hitbox dims: { width: D, height: H, depth: W }
        const sign = wall === "left" ? 1 : -1;
        const fx   = sign * D / 2;

        // Frame
        addBox(hitbox, `door_top_${uid}`,   { width: D,    height: fT,    depth: W },  0, H/2-fT/2, 0, 0.86, 0.83, 0.78);
        addBox(hitbox, `door_ljamb_${uid}`, { width: D,    height: slabH, depth: fT }, 0, jamCY, -W/2+fT/2, 0.86, 0.83, 0.78);
        addBox(hitbox, `door_rjamb_${uid}`, { width: D,    height: slabH, depth: fT }, 0, jamCY,  W/2-fT/2, 0.86, 0.83, 0.78);

        // Slab
        addBox(hitbox, `door_slab_${uid}`, { width: slabT, height: slabH, depth: slabW },
          fx - sign*(slabT/2 - 0.008), jamCY, 0,  0.62, 0.46, 0.27);

        // Mid rail
        addBox(hitbox, `door_midrail_${uid}`, { width: slabT+0.006, height: midRailH, depth: slabW },
          fx - sign*(slabT/2 - 0.011), midRailY, 0,  0.56, 0.41, 0.23);

        // Raised panels
        addBox(hitbox, `door_panel_up_${uid}`, { width: 0.014, height: upPH, depth: pW },
          fx + sign*0.010, upPY, 0,  0.70, 0.53, 0.30,  0.10, 0.08, 0.05);
        addBox(hitbox, `door_panel_lo_${uid}`, { width: 0.014, height: loPH, depth: pW },
          fx + sign*0.010, loPY, 0,  0.70, 0.53, 0.30,  0.10, 0.08, 0.05);

        // Handle backplate + knob
        const hz = slabW / 2 - 0.09;
        addBox(hitbox, `door_plate_${uid}`, { width: 0.016, height: 0.13, depth: 0.038 },
          fx + sign*0.018, midRailY, hz,  0.72, 0.60, 0.22,  0.50, 0.42, 0.15);
        const knob = MeshBuilder.CreateCylinder(`door_knob_${uid}`,
          { diameter: 0.038, height: 0.055, tessellation: 16 }, scene);
        knob.parent    = hitbox;
        knob.rotation.z = sign * Math.PI / 2;
        knob.position.set(fx + sign * 0.046, midRailY, hz);
        knob.isPickable = false;
        const km = new StandardMaterial(`door_knob_mat_${uid}`, scene);
        km.diffuseColor  = new Color3(0.78, 0.64, 0.20);
        km.specularColor = new Color3(0.62, 0.52, 0.16);
        knob.material = km;
      }
    };

    const buildOnWall = (wall, posX, posZ) => {
      if (activeHitbox) {
        activeHitbox.getChildMeshes().forEach(m => m.dispose());
        activeHitbox.dispose();
      }

      let hitbox, dragNormal, lockFn;
      let grabOffsetA = 0;

      if (wall === "back") {
        const wallZ = -4.9;
        hitbox = MeshBuilder.CreateBox(`door_${uid}`, { width: W, height: H, depth: D }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(Math.max(-5 + W/2, Math.min(5 - W/2, posX)), spawnY, wallZ);
        dragNormal = new Vector3(0, 0, 1);
        lockFn = (ev) => {
          const newX = Math.max(-5 + W/2, Math.min(5 - W/2, ev.dragPlanePoint.x + grabOffsetA));
          if (canMoveTo(hitbox, newX, spawnY, wallZ)) hitbox.position.x = newX;
          grabOffsetA = hitbox.position.x - ev.dragPlanePoint.x;
          hitbox.position.set(hitbox.position.x, spawnY, wallZ);
        };
      } else {
        const wallX = wall === "left" ? -4.9 : 4.9;
        hitbox = MeshBuilder.CreateBox(`door_${uid}`, { width: D, height: H, depth: W }, scene);
        hitbox.visibility = 0;
        hitbox.position.set(wallX, spawnY, Math.max(-5 + W/2, Math.min(5 - W/2, posZ)));
        dragNormal = wall === "left" ? new Vector3(1, 0, 0) : new Vector3(-1, 0, 0);
        lockFn = (ev) => {
          const newZ = Math.max(-5 + W/2, Math.min(5 - W/2, ev.dragPlanePoint.z + grabOffsetA));
          if (canMoveTo(hitbox, wallX, spawnY, newZ)) hitbox.position.z = newZ;
          grabOffsetA = hitbox.position.z - ev.dragPlanePoint.z;
          hitbox.position.set(wallX, spawnY, hitbox.position.z);
        };
      }

      addDoorDetail(hitbox, wall);
      activeHitbox = hitbox;
      meshRegistryRef.current[uid] = hitbox;

      if (!placed) {
        placed = true;
        addPlacedItem({
          uid, id: item.id, label: item.label, modelType: "wall",
          x: hitbox.position.x, z: hitbox.position.z, y: hitbox.position.y, wall,
        });
      }

      const dragBehavior = new PointerDragBehavior({ dragPlaneNormal: dragNormal });
      dragBehavior.moveAttached = false;
      dragBehavior.onDragStartObservable.add((ev) => {
        grabOffsetA = wall === "back"
          ? hitbox.position.x - ev.dragPlanePoint.x
          : hitbox.position.z - ev.dragPlanePoint.z;
      });
      dragBehavior.onDragObservable.add(lockFn);
      dragBehavior.onDragEndObservable.add(() => {
        const x = hitbox.position.x, z = hitbox.position.z;
        let nextWall = null;
        if (wall === "back") {
          if (x < -2.5) nextWall = "left";
          else if (x > 2.5) nextWall = "right";
        } else {
          if (z < -2.5) nextWall = "back";
        }
        if (nextWall) buildOnWall(nextWall, x, z);
        updateItem(uid, { x: activeHitbox.position.x, z: activeHitbox.position.z, y: spawnY, wall: nextWall ?? wall });
      });
      hitbox.addBehavior(dragBehavior);
    };

    buildOnWall(initialWall, pt.x, pt.z);
  };

  // Items whose id matches a file in /public/models/ are loaded as GLB; everything else is a box
  const GLB_ITEMS = ["shelf", "tripo-sofa", "eames-chair", "woodenbed", "oakchest"];

  // Core spawn logic — shared by mouse drop and touch release.
  // Always up-to-date via ref so touch handlers (mounted once) never go stale.
  const spawnAtClientPos = (clientX, clientY) => {
    const scene = sceneRef.current;
    const item = draggingItemRef.current;
    if (!scene || !item) return;

    const canvas = scene.getEngine().getRenderingCanvas();
    const rect = canvas.getBoundingClientRect();
    // Scale CSS-pixel coords to Babylon's internal canvas resolution (handles DPR / engine scaling)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

    const isWallItem = item.mountType === "wall" || ["tv", "window", "door"].includes(item.id);
    const WALL_NAMES = ["wallBack", "wallFront", "wallLeft", "wallRight"];

    let pickResult;
    if (isWallItem) {
      // Walls are non-pickable by default (so they don't block furniture picks).
      // Temporarily re-enable them so wall-item placement can detect which wall was hit.
      const wallMeshes = WALL_NAMES.map((n) => scene.getMeshByName(n)).filter(Boolean);
      wallMeshes.forEach((m) => { m.isPickable = true; });
      pickResult = scene.pick(x, y, (m) => WALL_NAMES.includes(m.name));
      wallMeshes.forEach((m) => { m.isPickable = false; });
    } else {
      pickResult = scene.pick(x, y);
    }

    if (!pickResult.hit) return;

    const { x: px, z: pz } = pickResult.pickedPoint;

    if (item.id === "tv") {
      spawnTV(scene, item, pickResult);
    } else if (item.id === "window") {
      spawnWindow(scene, item, pickResult);
    } else if (item.id === "door") {
      spawnDoor(scene, item, pickResult);
    } else if (item.mountType === "wall") {
      spawnWallBox(scene, item, pickResult);
    } else if (GLB_ITEMS.includes(item.id)) {
      spawnGLB(scene, item, px, pz);
    } else if (item.id === "bed") {
      spawnBed(scene, item, px, pz);
    } else if (item.id === "desk") {
      spawnDesk(scene, item, px, pz);
    } else if (item.id === "chair") {
      spawnChair(scene, item, px, pz);
    } else if (item.id === "couch") {
      spawnCouch(scene, item, px, pz);
    } else {
      spawnBox(scene, item, px, pz);
    }
  };
  // Keep the ref current every render so the once-mounted touch handlers can call it
  spawnAtClientPosRef.current = spawnAtClientPos;

  const handleDrop = (e) => {
    e.preventDefault();
    spawnAtClientPos(e.clientX, e.clientY);
  };

  // ── Room loader ──────────────────────────────────────────────────────────
  // When loadRoom() sets pendingLoad, dispose every current mesh, wipe the
  // registries, clear placedItems, then re-spawn each saved item in order.
  // GLB spawns are async so we process items sequentially with an async loop.
  useEffect(() => {
    if (!pendingLoad || !sceneRef.current) return;

    const scene = sceneRef.current;

    // Dispose all existing meshes (children are disposed recursively)
    Object.values(meshRegistryRef.current).forEach((m) => m.dispose());
    meshRegistryRef.current = {};
    rotClampRef.current = {};
    clearPlacedItems();
    clearPendingLoad();

    // Build a fake pickResult for wall items from saved position + wall name
    const makeWallPickResult = (saved) => ({
      pickedPoint: { x: saved.x, y: saved.y ?? 0, z: saved.z },
      pickedMesh:  { name: { back: "wallBack", left: "wallLeft", right: "wallRight" }[saved.wall] ?? "wallBack" },
    });

    // Re-spawn one saved item and apply its rotation once the mesh exists
    const respawnItem = async (saved) => {
      const beforeKeys = new Set(Object.keys(meshRegistryRef.current));

      const catalogItem = {
        id:         saved.id,
        label:      saved.label,
        dimensions: ITEM_DIMS[saved.id],
        mountType:  saved.modelType === "wall" ? "wall" : undefined,
      };

      if      (saved.id === "tv")                  spawnTV(scene, catalogItem, makeWallPickResult(saved));
      else if (saved.id === "window")              spawnWindow(scene, catalogItem, makeWallPickResult(saved));
      else if (saved.id === "door")                spawnDoor(scene, catalogItem, makeWallPickResult(saved));
      else if (saved.id === "bed")                 spawnBed(scene, catalogItem, saved.x, saved.z);
      else if (saved.id === "desk")                spawnDesk(scene, catalogItem, saved.x, saved.z);
      else if (saved.id === "chair")               spawnChair(scene, catalogItem, saved.x, saved.z);
      else if (saved.id === "couch")               spawnCouch(scene, catalogItem, saved.x, saved.z);
      else if (GLB_ITEMS.includes(saved.id))       await spawnGLB(scene, catalogItem, saved.x, saved.z);
      else                                         spawnBox(scene, catalogItem, saved.x, saved.z);

      // Apply saved rotation to the newly registered hitbox (floor items only)
      if (saved.rotation) {
        const newKey = Object.keys(meshRegistryRef.current).find((k) => !beforeKeys.has(k));
        if (newKey) {
          const mesh = meshRegistryRef.current[newKey];
          mesh.rotation.y = saved.rotation;
          // Sync clamp half-extents: odd number of 90° steps means W↔D are swapped
          const clamp = rotClampRef.current[newKey];
          if (clamp) {
            const steps = Math.round(saved.rotation / (Math.PI / 2)) % 4;
            if (Math.abs(steps) % 2 !== 0) [clamp.halfW, clamp.halfD] = [clamp.halfD, clamp.halfW];
          }
        }
      }
    };

    (async () => {
      for (const saved of pendingLoad) await respawnItem(saved);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLoad]);

  // ── Item deleter ─────────────────────────────────────────────────────────
  // When the Sidebar sets pendingDeleteUid, dispose the mesh (and its children),
  // remove it from both registries, then update the store.
  useEffect(() => {
    if (pendingDeleteUid === null) return;
    const mesh = meshRegistryRef.current[pendingDeleteUid];
    if (mesh) {
      mesh.dispose(); // disposes children recursively by default
      delete meshRegistryRef.current[pendingDeleteUid];
      delete rotClampRef.current[pendingDeleteUid];
    }
    removeItem(pendingDeleteUid);
    clearPendingDelete();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeleteUid]);

  // Fade out the hint as soon as the first item is placed
  useEffect(() => {
    if (placedItems.length > 0) setHintVisible(false);
  }, [placedItems.length]);

  return (
    <div className="w-screen bg-black relative overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Touch drag ghost — follows the finger so the user sees what they're placing */}
      {touchGhost && (
        <div
          className="fixed z-50 pointer-events-none select-none"
          style={{ left: touchGhost.x, top: touchGhost.y - 56, transform: 'translateX(-50%)' }}
        >
          <div className="bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-full shadow-xl whitespace-nowrap">
            {touchGhost.label}
          </div>
        </div>
      )}
      <Sidebar />
      {/* Canvas area fills the remaining space after the sidebar / bottom bar */}
      <div
        className="absolute top-0 right-0 bottom-44 left-0 md:bottom-0 md:left-64"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Controls hint — fades out after first item is placed */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-700"
          style={{ opacity: hintVisible ? 1 : 0 }}
        >
          <div className="bg-black/55 backdrop-blur-sm text-white/75 text-xs font-medium px-5 py-2.5 rounded-full flex items-center gap-3 border border-white/10 whitespace-nowrap">
            <span>⠿ Drag furniture to place</span>
            <span className="text-white/25">·</span>
            <span>Right-click to rotate</span>
          </div>
        </div>
        <BabylonCanvas onSceneReady={(scene) => {
          sceneRef.current = scene;

          // Right-click any floor item to rotate it 90° around Y.
          // Wall items are excluded (they have no entry in rotClampRef).
          scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
            if (pointerInfo.event.button !== 2) return;
            const pick = pointerInfo.pickInfo;
            if (!pick.hit || !pick.pickedMesh) return;
            const uid = Object.keys(meshRegistryRef.current).find(
              (k) => meshRegistryRef.current[k] === pick.pickedMesh
            );
            if (!uid) return;
            const clamp = rotClampRef.current[uid];
            if (!clamp) return;
            const mesh = meshRegistryRef.current[uid];
            mesh.rotation.y += Math.PI / 2;
            // Swap half-extents so drag boundary clamping stays correct after rotation
            const hw = clamp.halfW;
            clamp.halfW = clamp.halfD;
            clamp.halfD = hw;
            updateItem(Number(uid), { rotation: mesh.rotation.y });
          });
        }} />
      </div>
    </div>
  );
}
