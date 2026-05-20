#!/usr/bin/env bash
#
# Helper to fetch Quaternius dinosaur models into the /models/ folder.
# Because Quaternius distributes via Gumroad/Itch.io with rotating URLs,
# this script walks you through the manual steps rather than auto-downloading.
#
# Usage: ./scripts/fetch-quaternius.sh
set -e

cd "$(dirname "$0")/.."
MODELS_DIR="./models"
mkdir -p "$MODELS_DIR"

cat <<'EOF'
=========================================================
  DinoGrow — Quaternius model fetch helper
=========================================================

Quaternius makes free (CC0) low-poly dinosaur models. The game
runs fine without them, but they look great. Here's the easiest path:

1. Open one of these in your browser:

   - https://quaternius.com/packs/animatedultimatedinosaurs.html
   - https://quaternius.itch.io/lowpoly-animated-dinosaurs
   - https://poly.pizza/search/dinosaur  (individual CC0 dino .glb downloads)

2. Download the ZIP (or individual .glb files).

3. Unzip into a temp folder. You'll see files like
      Tyrannosaurus_Rex.glb
      Triceratops_Horridus.glb
      ...
   or directory structure containing .glb files.

4. Copy/rename them into the ./models/ folder so they match the
   expected names below. Anything missing will silently fall back to
   the built-in procedural dino.

Expected filenames in ./models/:
EOF

for f in Tyrannosaurus Triceratops Stegosaurus Velociraptor \
         Brachiosaurus Spinosaurus Ankylosaurus Parasaurolophus Pteranodon; do
  if [ -f "$MODELS_DIR/$f.glb" ]; then
    echo "   [x] $f.glb  (found)"
  else
    echo "   [ ] $f.glb"
  fi
done

cat <<'EOF'

When you're done, refresh the game and check the browser console.
You should see "[DinoGrow] Loaded N/9 GLB models: [...]".

Tip: if a Quaternius file has a different exact name, e.g.
'Tyrannosaurus_Rex.glb', just rename it to 'Tyrannosaurus.glb'.
EOF
