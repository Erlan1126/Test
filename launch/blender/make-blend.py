# Imports buildaroo-town.glb into a fresh Blender scene, adds a sun and a camera looking at
# the town like the game does, and saves buildaroo-town.blend next to it.
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P launch/blender/make-blend.py
import bpy, os, math
from mathutils import Vector

here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(here, "buildaroo-town.glb"))

# The town's middle and size.
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
mid, size = (lo + hi) / 2, max(hi.x - lo.x, hi.y - lo.y)

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
bpy.context.scene.collection.objects.link(sun)

cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = size * 0.9
cam.location = mid + Vector((size, -size, size * 0.95))
cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.clip_end = size * 10
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

world = bpy.data.worlds.new("Sky"); world.color = (0.62, 0.78, 0.95)
bpy.context.scene.world = world
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "buildaroo-town.blend"))
print("saved", len(objs), "meshes")
