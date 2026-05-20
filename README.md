# DinoGrow

A 3D dinosaur growth game for kids, built with [Three.js](https://threejs.org/) and pure HTML/CSS/JS. No build step. Designed for ages 6–8 to play on an iPhone via the browser.

## How to play

- Pick one of six dinosaurs on the title screen: **T-Rex**, **Triceratops**, **Stegosaurus**, **Velociraptor**, **Brachiosaurus**, or **Spinosaurus**. Each has different speed and final size.
- Move with the on-screen joystick (left thumb) or **WASD** on desktop.
- Tap the **CHOMP** button (or **Space** on desktop) to bite. Walking into food also eats it.
- Eat plants and smaller critters to fill the growth bar.
- Grow through 5 stages: **Hatchling → Juvenile → Sub-adult → Adult → GIANT**.
- Avoid enemy dinosaurs that are bigger than you — they will chase you. Once you outgrow them, they become food.
- Watch out for **Ankylosaurus**, **Parasaurolophus**, and flying **Pteranodons** roaming the world too.
- Explore three biomes: Forest, Swamp, and Desert.

## Upgraded visuals with Quaternius models (optional)

The game ships with procedural low-poly dinos so it works out of the box. You can swap in **Quaternius's free CC0 dinosaur models** for prettier visuals:

1. Run `./scripts/fetch-quaternius.sh` for step-by-step instructions, or read [`models/README.md`](models/README.md).
2. Drop `.glb` files into the `models/` folder using the expected filenames.
3. Reload — models auto-swap in. Missing files silently fall back to procedural.

## Run locally

Just open `index.html` over any local web server. Some examples:

```sh
# Python 3
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then visit `http://localhost:8000` in any modern browser.

> Note: opening the file directly via `file://` will not work, because the game uses ES modules and an import map. A local server is required.

## Host on GitHub Pages (free)

1. Push this repo to GitHub.
2. In your repo, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, pick **Deploy from a branch**.
4. Choose the branch (e.g. `main`) and `/ (root)` as the folder. Save.
5. After a minute or two, your game will be live at `https://<your-username>.github.io/<repo>/`.

## Add to iPhone home screen

1. Open the game URL in **Safari** on your iPhone.
2. Tap the **Share** button → **Add to Home Screen**.
3. Tap the new icon — the game opens fullscreen like a real app, no Safari UI.

## Structure

```
index.html              # entry point, HUD, title screen, touch controls
style.css               # all styling
icon.svg                # home-screen icon
src/
  main.js               # bootstrap, game loop, camera, eating logic
  controls.js           # keyboard + virtual joystick + chomp button
  world.js              # ground, biomes, decorations, edible plants
  entities.js           # player + enemy + critter setup, growth stages
  dinos.js              # procedural dino meshes + SPECIES registry
  modelLoader.js        # loads Quaternius GLB models, falls back to procedural
models/                 # drop Quaternius .glb files here (optional)
scripts/
  fetch-quaternius.sh   # walkthrough for downloading the Quaternius pack
```

## Design notes

- **Procedural meshes** (no model downloads) for instant load and no broken assets.
- **No fail-state spiral**: when "eaten", you respawn at one stage lower with growth reset to that threshold. Friendly for ages 6–8.
- **Predator/prey unified mechanic**: a bigger enemy chases you; once you outgrow them, you can eat them. This satisfies "avoid or fight" without explicit combat.
- **Low-poly aesthetic** keeps the game fast on iPhone.
