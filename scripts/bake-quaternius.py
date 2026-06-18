"""
Bake Quaternius (or any) FBX dinosaur animations into Three.js-friendly GLB
============================================================================

Run this in Blender's Scripting tab (Blender 3.x or 4.x).

What it fixes:
  Quaternius FBX rigs use IK constraints on the legs in Blender. When
  exported without baking, the IK constraints get dropped and the lower
  leg bones in the IK chain never get any animation keyframes - so in
  Three.js the upper leg swings forward from the clip while the lower leg
  stays at bind pose, and the mesh stretches across the gap.

  "Bake Action" with "Visual Keying" + "Clear Constraints" converts those
  IK-driven motions into per-bone position/rotation keyframes on every
  bone, every frame. After baking, Three.js's AnimationMixer plays the
  whole skeleton's motion correctly because the IK has been "frozen" into
  plain FK keyframes.

What it does:
  1. Reads every .fbx file from INPUT_DIR
  2. For each one, opens the file, bakes every action with Visual Keying
     + Clear Constraints, then exports as a GLB to OUTPUT_DIR
  3. Output filename is the same basename + .glb (e.g. Tyrannosaurus.fbx
     -> Tyrannosaurus.glb)

Setup:
  1. Edit INPUT_DIR and OUTPUT_DIR below for your machine.
  2. In Blender: Scripting tab -> New -> paste this file -> Run Script.
  3. Watch the system console (Window -> Toggle System Console on Windows,
     or run Blender from a terminal on macOS/Linux) for progress.

After it finishes, drop the GLB files in your repo's /models/ folder and
push - DinoGrow's loader auto-detects GLB and prefers it over FBX.
"""

import bpy
import os
import glob

# ===== EDIT THESE PATHS =====
# On Windows, either use forward slashes:   "C:/Users/you/dinos"
# or prefix with r for "raw string":        r"C:\Users\you\dinos"
# or double each backslash:                 "C:\\Users\\you\\dinos"
# (Plain "C:\Users\..." triggers a unicode-escape syntax error because
# Python reads "\U" as the start of a unicode codepoint.)
INPUT_DIR  = "/path/to/your/unzipped/quaternius/fbx/folder"
OUTPUT_DIR = "/path/to/where/you/want/the/glb/files"
# ============================


def clear_scene():
    """Wipe everything so each FBX starts in a clean Blender scene."""
    # Switch to object mode if any object is in edit/pose mode
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    # Delete everything
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Purge orphan data so memory doesn't grow per-file
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def find_armature():
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def bake_all_actions(armature):
    """Walk every action stored in the file and bake it onto this armature
    with Visual Keying + Clear Constraints. This is the IK-killer step."""
    actions = list(bpy.data.actions)
    print(f"  Baking {len(actions)} action(s)...")

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)

    # Make sure animation_data exists so we can assign actions
    if armature.animation_data is None:
        armature.animation_data_create()

    baked_actions = []
    for action in actions:
        # Assign as current action so bake_action targets it
        armature.animation_data.action = action

        # Compute frame range from the action
        try:
            fs = int(action.frame_range[0])
            fe = int(action.frame_range[1])
        except Exception:
            fs, fe = 1, 60

        # Switch to pose mode and select every bone, otherwise bake skips them
        bpy.ops.object.mode_set(mode='POSE')
        bpy.ops.pose.select_all(action='SELECT')

        # The magic call. Visual keying = use IK-evaluated positions, not the
        # IK target poses. Clear constraints = strip IK / track-to / etc.
        # so the exporter doesn't try to keep them.
        try:
            new_action = bpy.ops.nla.bake(
                frame_start=fs,
                frame_end=fe,
                only_selected=True,
                visual_keying=True,
                clear_constraints=True,
                use_current_action=True,
                bake_types={'POSE'},
            )
            # Rename so we can tell baked from original (optional)
            armature.animation_data.action.name = action.name
            baked_actions.append(armature.animation_data.action)
            print(f"    [ok] {action.name} ({fs}-{fe})")
        except Exception as e:
            print(f"    [fail] {action.name}: {e}")

        bpy.ops.object.mode_set(mode='OBJECT')

    # The bake leaves the last-baked action active. Push every baked action
    # into NLA strips so the GLTF exporter writes them all out.
    for action in baked_actions:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_range[0]), action)
    armature.animation_data.action = None  # so NLA strips are the sole source


def export_glb(output_path):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_apply=False,
        export_skins=True,
        export_morph=False,
        # Bake every NLA track into its own clip
        export_nla_strips=True,
    )


def process_one(fbx_path, output_path):
    print(f"\n--- {os.path.basename(fbx_path)} ---")
    clear_scene()

    try:
        bpy.ops.import_scene.fbx(filepath=fbx_path)
    except Exception as e:
        print(f"  Import failed: {e}")
        return False

    armature = find_armature()
    if not armature:
        print("  No armature in this file, skipping")
        return False

    bake_all_actions(armature)
    export_glb(output_path)
    print(f"  -> {output_path}")
    return True


def main():
    if not os.path.isdir(INPUT_DIR):
        print(f"INPUT_DIR not found: {INPUT_DIR}")
        return
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    fbx_files = sorted(glob.glob(os.path.join(INPUT_DIR, "**", "*.fbx"), recursive=True))
    if not fbx_files:
        print(f"No .fbx files found under {INPUT_DIR}")
        return

    print(f"Found {len(fbx_files)} FBX file(s)")
    ok, fail = 0, 0
    for fbx_path in fbx_files:
        base = os.path.splitext(os.path.basename(fbx_path))[0]
        output_path = os.path.join(OUTPUT_DIR, base + ".glb")
        if process_one(fbx_path, output_path):
            ok += 1
        else:
            fail += 1

    print(f"\nDone. Baked {ok}, failed {fail}.")


main()
