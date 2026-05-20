# 3D Models

This folder is **optional**. The game runs perfectly with procedural low-poly dinos. Drop Quaternius `.glb` files here to upgrade the visuals.

## Expected file names

The game looks for these files. Anything it can't find falls back to the built-in procedural mesh, automatically.

```
Tyrannosaurus.glb
Triceratops.glb
Stegosaurus.glb
Velociraptor.glb
Brachiosaurus.glb
Spinosaurus.glb
Ankylosaurus.glb
Parasaurolophus.glb
Pteranodon.glb
```

## Where to get the models

**Quaternius — Ultimate Animated Dinosaur Pack** (CC0 / public domain):

- Main site: https://quaternius.com/packs/animatedultimatedinosaurs.html
- Itch.io mirror: https://quaternius.itch.io/lowpoly-animated-dinosaurs

Both distribute a ZIP containing GLB/FBX files. Download, unzip, then copy the GLBs into this folder. The filenames in the pack may not match exactly — rename them to match the list above.

## Quick setup

From the repo root:

```sh
./scripts/fetch-quaternius.sh
```

The script prints the latest direct-download URLs and walks you through unzipping into this folder. Because Quaternius distribution links change over time, the script is interactive rather than fully automated.

## Notes

- The loader auto-scales each model to roughly the same length, centers it on (x, z), and drops its feet to y=0 — so different model sizes don't matter.
- Animation: GLB models currently use a simple whole-body bob. Built-in skeletal animations (if the pack includes them) aren't wired up yet — that's a future enhancement.
- Loading is async and parallel. The game starts immediately with procedural dinos; GLBs swap in as they finish loading.
