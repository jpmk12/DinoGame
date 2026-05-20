import * as THREE from 'three';
import { SPECIES } from './dinos.js';

// Loads Quaternius (or any) .glb models from /models/, with a graceful
// fallback to the procedural builder if the file is missing.
// Models are loaded once and cloned per instance.
//
// IMPORTANT: GLTFLoader is loaded dynamically the first time we need it,
// so a CDN issue with the loader cannot break the rest of the game.

let loaderPromise = null;
function getLoader() {
  if (!loaderPromise) {
    loaderPromise = import('three/addons/loaders/GLTFLoader.js')
      .then((mod) => new mod.GLTFLoader())
      .catch((err) => {
        console.warn('[DinoGrow] GLTFLoader unavailable, using procedural only:', err);
        return null;
      });
  }
  return loaderPromise;
}

const modelCache = new Map();      // species -> THREE.Group (loaded GLB scene)
const modelMissing = new Set();    // species we've already 404'd on (don't retry)
const pendingLoads = new Map();    // species -> Promise

const MODELS_BASE = './models/';
const TARGET_LENGTH = 2.0; // normalize all dinos to ~2 units long at scale 1.0

/**
 * Try to preload models from /models/. Always resolves; never throws.
 * If a probe HEAD request 404s, we skip ever trying to load.
 */
export async function preloadAllModels() {
  // Cheap probe: HEAD-check one expected file. If it's a 404, skip loading
  // entirely — the user hasn't dropped any Quaternius models in.
  let anyExist = false;
  try {
    const probe = await fetch(MODELS_BASE + SPECIES.trex.modelFile, { method: 'HEAD' });
    anyExist = probe.ok;
  } catch (_) {
    anyExist = false;
  }
  if (!anyExist) return [];

  const promises = [];
  for (const key of Object.keys(SPECIES)) {
    promises.push(tryLoadModel(key));
  }
  return Promise.allSettled(promises);
}

async function tryLoadModel(speciesKey) {
  if (modelCache.has(speciesKey)) return modelCache.get(speciesKey);
  if (modelMissing.has(speciesKey)) return null;
  if (pendingLoads.has(speciesKey)) return pendingLoads.get(speciesKey);

  const spec = SPECIES[speciesKey];
  if (!spec || !spec.modelFile) {
    modelMissing.add(speciesKey);
    return null;
  }

  const url = MODELS_BASE + spec.modelFile;
  const p = (async () => {
    const loader = await getLoader();
    if (!loader) {
      modelMissing.add(speciesKey);
      return null;
    }
    return new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          normalizeModel(root, spec);
          modelCache.set(speciesKey, root);
          resolve(root);
        },
        undefined,
        () => {
          modelMissing.add(speciesKey);
          resolve(null);
        }
      );
    });
  })();
  pendingLoads.set(speciesKey, p);
  return p;
}

/**
 * Resize/recenter loaded model so it stands on y=0 with consistent forward (-Z)
 * orientation and roughly TARGET_LENGTH along its longest horizontal axis.
 */
function normalizeModel(root, spec) {
  // Apply shadow casting and tweak materials for the low-poly vibe
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  // Measure bounding box, scale to target length, drop feet to y=0
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const longest = Math.max(size.x, size.z) || size.y || 1;
  const s = TARGET_LENGTH / longest;
  root.scale.multiplyScalar(s);

  // Re-measure after scaling
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  // Move so feet sit on y=0 and center on x/z
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y;
}

/**
 * Build a dino for a given species. Returns a Promise<THREE.Group>.
 * Uses the GLB if loaded, else falls back to the procedural builder.
 *
 * The returned group already has userData populated (kind, species, etc.)
 * by the caller — this just gives you the visual mesh.
 */
export async function createDinoMesh(speciesKey) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);

  const loaded = await tryLoadModel(speciesKey);
  if (loaded) {
    const inst = loaded.clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {}; // GLBs have no procedural parts; animation falls back to bob
    return inst;
  }
  // Procedural fallback
  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

/**
 * Synchronous procedural-only build (used during initial scene setup before
 * preload finishes, and for instances where async is awkward).
 */
export function createDinoMeshSync(speciesKey) {
  const spec = SPECIES[speciesKey];
  if (!spec) throw new Error(`Unknown species: ${speciesKey}`);

  // If GLB is already cached, use it immediately
  if (modelCache.has(speciesKey)) {
    const inst = modelCache.get(speciesKey).clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {};
    return inst;
  }

  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

export function modelStatus() {
  return {
    loaded: [...modelCache.keys()],
    missing: [...modelMissing],
    total: Object.keys(SPECIES).length,
  };
}
