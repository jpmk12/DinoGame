import * as THREE from 'three';
import { SPECIES } from './dinos.js';

// Loads Quaternius (or any) dinosaur models from /models/, with a graceful
// fallback to the procedural builder if the file is missing. Supports both
// GLB/glTF and FBX out of the box — whichever the user has dropped in
// /models/ for the trex slot is the format we use for the rest of the run.

let glbLoaderPromise = null;
function getGlbLoader() {
  if (!glbLoaderPromise) {
    glbLoaderPromise = import('three/addons/loaders/GLTFLoader.js')
      .then((mod) => new mod.GLTFLoader())
      .catch((err) => {
        console.warn('[DinoGrow] GLTFLoader unavailable:', err);
        return null;
      });
  }
  return glbLoaderPromise;
}

let fbxLoaderPromise = null;
function getFbxLoader() {
  if (!fbxLoaderPromise) {
    fbxLoaderPromise = import('three/addons/loaders/FBXLoader.js')
      .then((mod) => new mod.FBXLoader())
      .catch((err) => {
        console.warn('[DinoGrow] FBXLoader unavailable:', err);
        return null;
      });
  }
  return fbxLoaderPromise;
}

const modelCache = new Map();
const modelMissing = new Set();
const pendingLoads = new Map();

const MODELS_BASE = './models/';
const TARGET_LENGTH = 2.0;

// Which extension to use for this run. Detected at preload by HEAD-probing
// the trex file in both formats. 'glb' wins ties since it's lighter.
let modelExt = null;

function expectedFile(speciesKey, ext = modelExt) {
  const spec = SPECIES[speciesKey];
  if (!spec || !spec.modelFile) return null;
  // SPECIES.modelFile is stored with the .glb extension; swap to detected.
  const base = spec.modelFile.replace(/\.(glb|fbx)$/i, '');
  return base + '.' + (ext || 'glb');
}

/**
 * Try to preload models from /models/. Always resolves; never throws.
 * Detects whether the user has uploaded GLB or FBX files by HEAD-probing
 * both formats for the T-Rex entry; if neither exists we skip loading
 * entirely so there's no console noise.
 */
export async function preloadAllModels() {
  // Probe both formats for the trex (the only species that must exist for
  // detection). Whichever responds with 200 wins.
  const trexBase = SPECIES.trex.modelFile.replace(/\.(glb|fbx)$/i, '');
  const candidates = ['glb', 'fbx'];
  for (const ext of candidates) {
    try {
      const probe = await fetch(MODELS_BASE + trexBase + '.' + ext, { method: 'HEAD' });
      if (probe.ok) { modelExt = ext; break; }
    } catch (_) { /* try next */ }
  }
  if (!modelExt) return [];

  const promises = [];
  for (const key of Object.keys(SPECIES)) {
    promises.push(tryLoadModel(key));
  }
  return Promise.allSettled(promises);
}

let skUtilsPromise = null;
function getSkeletonUtils() {
  if (!skUtilsPromise) {
    skUtilsPromise = import('three/addons/utils/SkeletonUtils.js')
      .then((mod) => mod)
      .catch(() => null);
  }
  return skUtilsPromise;
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

  const url = MODELS_BASE + expectedFile(speciesKey);
  const isFbx = modelExt === 'fbx';

  const p = (async () => {
    const loader = isFbx ? await getFbxLoader() : await getGlbLoader();
    if (!loader) {
      modelMissing.add(speciesKey);
      return null;
    }
    return new Promise((resolve) => {
      loader.load(
        url,
        (loaded) => {
          // GLTFLoader returns { scene, animations }; FBXLoader returns a Group
          // directly with .animations on it.
          const root = isFbx ? loaded : loaded.scene;
          const animations = isFbx ? (loaded.animations || []) : (loaded.animations || []);
          normalizeModel(root, spec);
          root.userData.animations = animations;
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

  if (modelCache.has(speciesKey)) {
    const cached = modelCache.get(speciesKey);
    const inst = cached.clone(true);
    inst.userData.fromGLB = true;
    inst.userData.parts = {};
    inst.userData.animations = cached.userData.animations || [];
    inst.userData.pendingMixer = inst.userData.animations.length > 0;
    return inst;
  }

  const proc = spec.build(spec.color);
  proc.userData.fromGLB = false;
  return proc;
}

/**
 * Build an AnimationMixer + named actions for a GLB instance. Returns null
 * for procedural meshes or if SkeletonUtils isn't available. Picks the
 * best-matching clip names for idle/walk/run/attack heuristically.
 */
export async function attachMixer(instance, THREE) {
  if (!instance.userData.fromGLB) return null;
  const clips = instance.userData.animations;
  if (!clips || clips.length === 0) return null;

  // For skinned meshes, the default clone shares the skeleton — re-clone
  // via SkeletonUtils so animations don't move every other instance.
  const SK = await getSkeletonUtils();
  if (SK && SK.clone) {
    // Replace bones/skin properly. (Call sites add the instance to the
    // scene after this, so re-cloning is safe.)
    const re = SK.clone(instance);
    instance.clear();
    for (const child of [...re.children]) instance.add(child);
  }

  const mixer = new THREE.AnimationMixer(instance);
  const actions = {};
  for (const clip of clips) {
    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
  }
  // Pick a reasonable default to play
  const pick = (...names) => names.map((n) => actions[n.toLowerCase()]).find(Boolean);
  const idle = pick('idle', 'idle_a', 'idle_1', 'stand', clips[0].name);
  if (idle) idle.play();

  instance.userData.mixer = mixer;
  instance.userData.actions = actions;
  instance.userData.currentAction = idle || null;
  instance.userData.pendingMixer = false;
  return mixer;
}

/**
 * Switch the model's playing animation based on a speed factor (0=idle, 1=run).
 * Crossfades between idle / walk / run if those clips exist. No-op for
 * procedural meshes (which keep their hand-coded leg-swing animation).
 */
export function setMotion(instance, speedNorm, fade = 0.2) {
  if (!instance || !instance.userData.actions) return;
  const acts = instance.userData.actions;
  const pick = (...names) => names.map((n) => acts[n.toLowerCase()]).find(Boolean);
  let target;
  if (speedNorm > 0.7)      target = pick('run', 'gallop', 'walk', 'walking', 'idle', 'idle_a');
  else if (speedNorm > 0.1) target = pick('walk', 'walking', 'run', 'idle', 'idle_a');
  else                      target = pick('idle', 'idle_a', 'idle_b', 'stand');
  if (!target) return;
  if (instance.userData.currentAction === target) return;
  if (instance.userData.currentAction) instance.userData.currentAction.fadeOut(fade);
  target.reset().fadeIn(fade).play();
  instance.userData.currentAction = target;
}

export function modelStatus() {
  return {
    loaded: [...modelCache.keys()],
    missing: [...modelMissing],
    total: Object.keys(SPECIES).length,
  };
}
