# Buildaroo's Grand Stadium, modelled in code in Blender: a bowl of stands round a pitch,
# a roof canopy, floodlight towers, entrance arches and flags. Soft shadows (ambient
# occlusion) are baked into the model's colours, so it looks rich in the game at no cost.
# Run (Mac):  /Applications/Blender.app/Contents/MacOS/Blender -b -P launch/blender/stadium.py
# Run (bpy):  python launch/blender/stadium.py   (with `pip install bpy`)
# Writes launch/blender/stadium.glb (and stadium.blend + a preview picture to look at).
# scripts/kit-embed.py then takes the model into the game as src/render3d/kit/bl_stadium.glb.
import bpy, bmesh, math, os, mathutils

here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

mats = {}
def mat(name, rgb, rough=0.7, metal=0.0, emit=0.0):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    mats[name] = m
    return m

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

WHITE = mat("white", srgb("#f4f2ee"), 0.6)
CONC = mat("concrete", srgb("#c9c4bc"), 0.85)
SEAT_A = mat("seat_purple", srgb("#6a4cff"), 0.6)
SEAT_B = mat("seat_pink", srgb("#ff5f8f"), 0.6)
GRASS = mat("pitch", srgb("#4caf50"), 0.9)
GRASS2 = mat("pitch_stripe", srgb("#5cc062"), 0.9)
LINE = mat("lines", srgb("#ffffff"), 0.6)
METAL = mat("steel", srgb("#8a90a0"), 0.4, 0.6)
ROOF = mat("roof", srgb("#ffffff"), 0.35)
GLASS = mat("glass", srgb("#9fd4ff"), 0.15, 0.2)
LAMP = mat("lamp", srgb("#fff3c0"), 0.3, 0.0, 3.0)
FLAG = [mat(f"flag{i}", srgb(c), 0.6) for i, c in enumerate(["#ff5f6d", "#ffd23a", "#4f8bff", "#5ee0a0"])]

objs = []
def add(o, m):
    o.data.materials.append(m); objs.append(o); return o

def box(sx, sy, sz, x, y, z, m, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z), rotation=(0, 0, rz))
    o = bpy.context.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True, rotation=True)
    return add(o, m)

def cyl(r, h, x, y, z, m, verts=12, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=h, location=(x, y, z))
    return add(bpy.context.object, m)

# The ring the stands follow: an oval (a stadium shape).
A, B = 13.0, 9.0
def oval(t, a, b):
    return a * math.cos(t), b * math.sin(t)

def oval_ring(a0, b0, a1, b1, z0, z1, m, segs=64, z0in=None, z1in=None):
    """A solid ring between an inner oval (a0, b0) and an outer one (a1, b1). The top runs from
    z1in (inner edge) to z1 (outer edge), so it can slope like stands."""
    z0in = z0 if z0in is None else z0in; z1in = z1 if z1in is None else z1in
    me = bpy.data.meshes.new("ring"); bm = bmesh.new()
    rows = []
    for k in range(segs):
        t = 2 * math.pi * k / segs
        xi, yi = oval(t, a0, b0); xo, yo = oval(t, a1, b1)
        rows.append([bm.verts.new((xi, yi, z0in)), bm.verts.new((xo, yo, z0)), bm.verts.new((xo, yo, z1)), bm.verts.new((xi, yi, z1in))])
    for k in range(segs):
        r0, r1 = rows[k], rows[(k + 1) % segs]
        for j in range(4):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % 4], r0[(j + 1) % 4]))
    bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("ring", me); scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")
    o.select_set(False)
    return add(o, m)

# Ground plinth and the pitch, mown in stripes, with its lines.
cyl(1, 0.4, 0, 0, 0.2, CONC, 48).scale = (A + 4.2, B + 4.2, 1)
bpy.ops.object.transform_apply(scale=True)
box(20, 11.5, 0.12, 0, 0, 0.46, GRASS)
for i in range(-4, 5, 2): box(2.2, 11.5, 0.125, i * 2.2, 0, 0.465, GRASS2)
for (sx, sy, x, y) in [(20, 0.12, 0, 5.7), (20, 0.12, 0, -5.7), (0.12, 11.5, 10, 0), (0.12, 11.5, -10, 0), (0.12, 11.5, 0, 0)]:
    box(sx, sy, 0.13, x, y, 0.47, LINE)
bpy.ops.mesh.primitive_torus_add(major_radius=1.8, minor_radius=0.06, location=(0, 0, 0.53))
add(bpy.context.object, LINE)
for gx in (-10, 10):  # goals
    box(0.1, 2.6, 0.1, gx, 0, 1.4, WHITE); box(0.1, 0.1, 0.9, gx, 1.3, 0.95, WHITE); box(0.1, 0.1, 0.9, gx, -1.3, 0.95, WHITE)

N = 28
# The stands: a sloping concrete bowl, with rows of seats in alternating colours on it.
oval_ring(A + 0.1, B + 0.1, A + 4.0, B + 4.0, 0.45, 3.4, CONC, 64, 0.45, 0.6)
for row in range(6):
    f0, f1 = row / 6, (row + 0.62) / 6
    a0, a1 = A + 0.3 + f0 * 3.6, A + 0.3 + f1 * 3.6
    z0, z1 = 0.62 + f0 * 2.8 + 0.04, 0.62 + f1 * 2.8 + 0.04
    oval_ring(a0, a0 - (A - B), a1, a1 - (A - B), z0 - 0.05, z1 + 0.06, SEAT_A if row % 2 else SEAT_B, 64, z0 - 0.05, z0 + 0.06)
# The outer wall with windows, and four entrance arches.
oval_ring(A + 3.95, B + 3.95, A + 4.3, B + 4.3, 0.4, 3.8, WHITE, 64)
for k in range(N):
    t0, t1 = 2 * math.pi * k / N, 2 * math.pi * (k + 1) / N
    x0, y0 = oval(t0, A + 4.1, B + 4.1); x1, y1 = oval(t1, A + 4.1, B + 4.1)
    ang = math.atan2(y1 - y0, x1 - x0); L = math.hypot(x1 - x0, y1 - y0) + 0.05
    if k % 2 == 0:
        xm, ym = oval((t0 + t1) / 2, A + 4.3, B + 4.3)
        box(L * 0.5, 0.06, 1.1, xm, ym, 2.4, GLASS, ang)
for t in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
    x, y = oval(t, A + 4.5, B + 4.5)
    box(2.6, 0.9, 2.2, x, y, 1.5, CONC, t + math.pi / 2)
    box(2.0, 0.95, 1.4, x, y, 1.1, GLASS, t + math.pi / 2)

# The roof canopy: one white ring over the top rows, on steel posts.
oval_ring(A + 1.6, B + 1.6, A + 4.4, B + 4.4, 3.95, 4.2, ROOF, 64, 4.05, 4.25)
for k in range(0, N, 4):
    xp, yp = oval(2 * math.pi * k / N, A + 4.1, B + 4.1)
    cyl(0.1, 4.1, xp, yp, 2.1, METAL, 8)

# Floodlight towers at the corners, with lit lamp heads.
for t in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
    x, y = oval(t, A + 5.2, B + 5.2)
    cyl(0.18, 7.5, x, y, 3.75, METAL, 8, 0.1)
    box(1.6, 0.25, 0.9, x, y, 7.6, METAL, t + math.pi / 2)
    box(1.4, 0.05, 0.7, x - math.cos(t) * 0.15, y - math.sin(t) * 0.15, 7.6, LAMP, t + math.pi / 2)

# Flags all round the rim.
for k in range(16):
    t = 2 * math.pi * k / 16
    x, y = oval(t, A + 4.1, B + 4.1)
    cyl(0.04, 1.4, x, y, 4.5, METAL, 6)
    box(0.6, 0.03, 0.35, x + 0.3 * math.cos(t + 1.57), y + 0.3 * math.sin(t + 1.57), 5.0, FLAG[k % 4], t + math.pi / 2)

# One mesh (kept as several materials), then soft shadows baked into its vertex colours.
bpy.ops.object.select_all(action="DESELECT")
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
st = bpy.context.object; st.name = "Stadium"
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.remove_doubles(threshold=0.001); bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.shade_flat()

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.world = bpy.data.worlds.new("w"); scene.world.color = (1, 1, 1)
attr = st.data.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
st.data.color_attributes.active_color = attr
scene.render.bake.target = "VERTEX_COLORS"
bpy.ops.object.bake(type="AO")
# Soften the bake (shadows a little lighter), so colours stay bright.
for c in attr.data:
    k = 0.55 + 0.45 * c.color[0]
    c.color = (k, k, k, 1)

# Centre it on the ground, and save.
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
st.location = (0, 0, st.dimensions.z / 2)
bpy.ops.export_scene.gltf(filepath=os.path.join(here, "stadium.glb"), export_format="GLB", use_selection=False,
                          export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_apply=True, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "stadium.blend"))
print("stadium triangles", sum(len(p.vertices) - 2 for p in st.data.polygons))

# A preview picture, from the game's angle.
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); cam.data.type = "ORTHO"; cam.data.ortho_scale = 40
cam.location = (30, -30, 26); scene.collection.objects.link(cam); scene.camera = cam
cam.rotation_euler = (mathutils.Vector((0, 0, 2)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); sun.data.energy = 3; sun.rotation_euler = (0.8, 0.2, 0.6); scene.collection.objects.link(sun)
scene.render.resolution_x = scene.render.resolution_y = 720
scene.cycles.samples = 24
scene.render.filepath = os.path.join(here, "stadium-preview.png")
bpy.ops.render.render(write_still=True)
