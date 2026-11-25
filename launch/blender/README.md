# Buildaroo town for Blender

`buildaroo-town.glb` is the whole town (a full, lived-in city with every lot built),
exported from the game itself, then Draco-compressed to 5 MB. Blender opens it with
File ▸ Import ▸ glTF 2.0. `buildaroo-town.blend` (made on the Mac) is the same, already
imported, with a sun and a camera.

The game draws the town in code each time it runs, so this is a snapshot: changes made in
Blender don't flow back into the game by themselves. Shader effects (snow, wet streets,
night lights) are the game's own and don't come across; the colours and shapes do.
