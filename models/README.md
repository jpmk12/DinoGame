# Animated dinosaur models — `/models/`

Drop the Quaternius **Ultimate Animated Dinosaurs Pack** (free CC0) in here
and the game will swap its procedural box-dinos for fully-rigged,
animated models — walking, running, attacking, the whole thing. This is the
**single biggest visual upgrade** available without changing any code.

## Quick setup (5 minutes)

### 1. Download the pack

Pick one of these (both are the same free CC0 pack):

- https://quaternius.com/packs/animatedultimatedinosaurs.html
- https://quaternius.itch.io/lowpoly-animated-dinosaurs

### 2. Unzip it anywhere

You'll get a folder like `UltimateAnimatedDinosaurs/` containing GLB files
(possibly under a subfolder named `GLB/`, `Models/`, or similar).

### 3. Run the install script

From the repo root, on macOS / Linux:

```sh
./scripts/install-quaternius.sh /path/to/UltimateAnimatedDinosaurs
```

On Windows, use Git Bash (comes with Git for Windows) the same way:

```sh
./scripts/install-quaternius.sh "C:/Downloads/UltimateAnimatedDinosaurs"
```

The script searches recursively for matching `.glb` files using common
naming variations and copies them into `/models/` with the names the game
expects. It prints `[ok]` / `[miss]` for each species.

### 4. Refresh the game

Hard-refresh the page. The title screen will now show a gold badge under
the dino picker like:

> 🦴 8 / 9 animated GLB models loaded

If you see that, the dinos are now animated. Anything that didn't get a
GLB falls back automatically to its procedural mesh.

## Expected filenames

The game accepts **either `.glb`/glTF or `.fbx`** files — it auto-detects
the format at startup. Use the extension your pack came with. Mixed formats
in the same `/models/` folder will use whichever shows up first (GLB wins).

```
Tyrannosaurus.glb   or   Tyrannosaurus.fbx
Triceratops.glb     or   Triceratops.fbx
Stegosaurus.glb     or   Stegosaurus.fbx
Velociraptor.glb    or   Velociraptor.fbx
Brachiosaurus.glb   or   Brachiosaurus.fbx
Spinosaurus.glb     or   Spinosaurus.fbx
Ankylosaurus.glb    or   Ankylosaurus.fbx
Parasaurolophus.glb or   Parasaurolophus.fbx
Pteranodon.glb      or   Pteranodon.fbx
```

Anything missing falls back to the procedural mesh; the game never breaks.

The Titan (Plasma Breath beam-monster) is procedural-only by design.

## Manual install if the script can't find your files

If your pack uses unusual filenames, copy them manually:

```sh
cp YourFile.glb  ./models/Tyrannosaurus.glb
```

## How it works under the hood

- `src/modelLoader.js` does a single HEAD probe on `models/Tyrannosaurus.glb`
  at startup. If it 404s, nothing tries to load — the game runs on
  procedural meshes with no console noise.
- When at least one file exists, it lazy-loads `GLTFLoader` and
  `SkeletonUtils` from the Three.js CDN.
- Each model is loaded once, then cloned per instance. `SkeletonUtils.clone`
  is used so multiple Raptors (or whatever) each get their own skeleton —
  they don't all animate in lockstep.
- A `THREE.AnimationMixer` is attached per instance with named actions
  keyed by clip name. The first found `idle` / `idle_a` / `stand` /
  `(first clip)` is auto-played.
- The game loop ticks every active mixer each frame in `pumpMixers(dt)`.

If you want fancier animation behavior (walk while moving, attack on
chomp, etc.), the hook is in `main.js` — search for `pumpMixers`. The
mixers and named actions are exposed via `instance.userData.actions` so
you can `.play()` / `.crossFadeTo()` whichever clip you want from anywhere.
