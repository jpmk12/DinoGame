#!/usr/bin/env bash
#
# install-quaternius.sh — copies Quaternius dinosaur GLB models into ./models/
# under the filenames DinoGrow expects.
#
# Usage:
#   1. Download the Quaternius "Ultimate Animated Dinosaurs" pack (free, CC0):
#        https://quaternius.com/packs/animatedultimatedinosaurs.html
#      or directly from itch.io:
#        https://quaternius.itch.io/lowpoly-animated-dinosaurs
#   2. Unzip it anywhere on your machine.
#   3. Run this script from the repo root, pointing at the unzipped folder:
#        ./scripts/install-quaternius.sh /path/to/UltimateAnimatedDinosaurs
#
# The script searches recursively for matching .glb files using a few common
# naming variations and copies them into ./models/ with DinoGrow's filenames.
# Anything it can't find is reported; the game falls back to procedural
# meshes for those species automatically.

set -e

SOURCE_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELS_DIR="$REPO_ROOT/models"

if [ -z "$SOURCE_DIR" ]; then
  cat <<EOF
Usage: $0 /path/to/unzipped/quaternius/pack

Tip: the unzipped folder usually has subfolders like GLB/ or Models/ with
the actual .glb files. You can point this script at the top-level folder
or directly at the subfolder — it searches recursively.

Pack download links:
  https://quaternius.com/packs/animatedultimatedinosaurs.html
  https://quaternius.itch.io/lowpoly-animated-dinosaurs
EOF
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: '$SOURCE_DIR' is not a directory."
  exit 1
fi

mkdir -p "$MODELS_DIR"

echo "Looking for Quaternius dinosaur models in:"
echo "  $SOURCE_DIR"
echo "Installing into:"
echo "  $MODELS_DIR"
echo

# Map: target filename | space-separated candidate basenames (lower-case)
# Candidates are matched case-insensitively against the file basename WITHOUT
# extension. First match wins.
MAPPINGS=(
  "Tyrannosaurus|tyrannosaurus tyrannosaurus_rex t_rex trex t-rex"
  "Triceratops|triceratops triceratops_horridus trike"
  "Stegosaurus|stegosaurus stego"
  "Velociraptor|velociraptor raptor"
  "Brachiosaurus|brachiosaurus brachio"
  "Spinosaurus|spinosaurus spino"
  "Ankylosaurus|ankylosaurus anky"
  "Parasaurolophus|parasaurolophus para"
  "Pteranodon|pteranodon pteradactylus pterodactyl ptero"
)

found=0
missing=()

# Build an index of all .glb files in the source tree, keyed by lower-case basename
declare -A INDEX
while IFS= read -r path; do
  base="$(basename "$path" .glb)"
  base_lc="$(echo "$base" | tr '[:upper:]' '[:lower:]')"
  INDEX["$base_lc"]="$path"
done < <(find "$SOURCE_DIR" -type f -name '*.glb')

for mapping in "${MAPPINGS[@]}"; do
  target="${mapping%%|*}"
  candidates="${mapping#*|}"
  match=""
  for cand in $candidates; do
    if [ -n "${INDEX[$cand]:-}" ]; then
      match="${INDEX[$cand]}"
      break
    fi
  done
  if [ -n "$match" ]; then
    cp -f "$match" "$MODELS_DIR/$target.glb"
    echo "  [ok]    $target.glb  <-  $(basename "$match")"
    found=$((found + 1))
  else
    echo "  [miss]  $target.glb  (looked for: $candidates)"
    missing+=("$target")
  fi
done

echo
echo "Installed $found / ${#MAPPINGS[@]} models."
if [ "${#missing[@]}" -gt 0 ]; then
  cat <<EOF

Some files weren't found. The game still runs — missing species fall back
to the procedural low-poly mesh. If you have them under different filenames,
either rename them to match the targets above, or copy them manually:

  cp YourFile.glb  $MODELS_DIR/<ExpectedName>.glb

Expected filenames:
EOF
  for m in "${missing[@]}"; do echo "  - $m.glb"; done
fi

echo
echo "Refresh the game (hard refresh) to pick them up. The title screen will"
echo "show how many GLB models are loaded under the dino picker."
