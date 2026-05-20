# DinoGrow

A 3D dinosaur growth game for kids, built with [Three.js](https://threejs.org/) and pure HTML/CSS/JS. No build step. Designed for ages 6–8 to play on an iPhone via the browser.

## How to play

- Pick **T-Rex** or **Triceratops** on the title screen.
- Move with the on-screen joystick (left thumb) or **WASD** on desktop.
- Tap the **CHOMP** button (or **Space** on desktop) to bite. Walking into food also eats it.
- Eat plants and smaller critters to fill the growth bar.
- Grow through 5 stages: **Hatchling → Juvenile → Sub-adult → Adult → GIANT**.
- Avoid enemy dinosaurs that are bigger than you — they will chase you. Once you outgrow them, they become food.
- Explore three biomes: Forest, Swamp, and Desert.

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
index.html        # entry point, HUD, title screen, touch controls
style.css         # all styling
icon.svg          # home-screen icon
src/
  main.js         # bootstrap, game loop, camera, eating logic
  controls.js     # keyboard + virtual joystick + chomp button
  world.js        # ground, biomes, decorations, edible plants
  entities.js     # player + enemy + critter setup, growth stages
  dinos.js        # procedural low-poly dino meshes
```

## Design notes

- **Procedural meshes** (no model downloads) for instant load and no broken assets.
- **No fail-state spiral**: when "eaten", you respawn at one stage lower with growth reset to that threshold. Friendly for ages 6–8.
- **Predator/prey unified mechanic**: a bigger enemy chases you; once you outgrow them, you can eat them. This satisfies "avoid or fight" without explicit combat.
- **Low-poly aesthetic** keeps the game fast on iPhone.
