# Buildaroo's landmarks, modelled in code in Blender like the stadium (stadium.py): the clock
# tower, the lighthouse, the Ferris wheel (its base and the wheel that turns, as two models) and
# the airport. Each is low-poly and cartoony, on a 16 x 16 lot, with soft shadows (ambient
# occlusion) baked into its vertex colours so it looks rich in the game at no cost.
# Run (Mac):  /Applications/Blender.app/Contents/MacOS/Blender -b -P launch/blender/landmarks.py -- [names]
# Run (bpy):  python launch/blender/landmarks.py [names]   (with `pip install bpy`)
# names: clocktower lighthouse ferris_base ferris_wheel airport (all of them if none are given).
# Writes launch/blender/<name>.glb, <name>.blend and <name>-preview.png (plus ferris-preview.png,
# the base and the wheel together). Each .glb is then slimmed with glTF-Transform: every part's
# colour folded into its vertex colours, one shared material (glowing parts keep theirs), joined
# into one mesh and quantized; saved as src/render3d/kit/bl_<name>.glb, after which
# scripts/kit-embed.py takes it into the game.
import bpy, bmesh, math, os, sys, mathutils
from mathutils import Matrix, Vector

here = os.path.dirname(os.path.abspath(__file__))
PI = math.pi

# ---- Materials ---------------------------------------------------------------------------
mats = {}
def mat(name, rgb, rough=0.7, metal=0.0, emit=0.0):
    if name in mats and mats[name].name in bpy.data.materials: return mats[name]
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

def C(name, hexc, rough=0.7, metal=0.0, emit=0.0):
    return mat(name, srgb(hexc), rough, metal, emit)

# ---- Geometry helpers (all built with bmesh, placed by a matrix) --------------------------
objs = []
def add(o, m):
    o.data.materials.append(m); objs.append(o); return o

def place(x, y, z, rz=0.0, rx=0.0, ry=0.0, s=(1, 1, 1)):
    return (Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y")
            @ Matrix.Rotation(rx, 4, "X") @ Matrix.Diagonal((*s, 1)))

def finish_bm(bm, m, M):
    bm.transform(M)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("part"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("part", me); bpy.context.scene.collection.objects.link(o)
    return add(o, m)

def box(sx, sy, sz, x, y, z, m, rz=0.0, rx=0.0, ry=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    return finish_bm(bm, m, place(x, y, z, rz, rx, ry, (sx, sy, sz)))

def cyl(r, h, x, y, z, m, verts=12, r2=None, rz=0.0, rx=0.0, ry=0.0):
    """A cylinder (or cone, frustum) standing on its axis (Z), centred at (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r,
                          radius2=r if r2 is None else r2, depth=h)
    return finish_bm(bm, m, place(x, y, z, rz, rx, ry))

def ball(r, x, y, z, m, sub=1, sz=1.0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return finish_bm(bm, m, place(x, y, z, s=(1, 1, sz)))

def beam(p0, p1, w, d, m):
    """A square bar from p0 to p1 (w wide, d deep)."""
    p0, p1 = Vector(p0), Vector(p1); v = p1 - p0
    q = v.to_track_quat("Z", "Y")
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    M = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((w, d, v.length, 1))
    return finish_bm(bm, m, M)

def prism(pts, depth, m, M):
    """A convex outline pts [(u, v)] in the XZ plane, extruded along Y (depth, centred)."""
    bm = bmesh.new()
    f = [bm.verts.new((u, -depth / 2, v)) for u, v in pts]
    b = [bm.verts.new((u, depth / 2, v)) for u, v in pts]
    n = len(pts)
    bm.faces.new(f); bm.faces.new(b[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((f[i], f[j], b[j], b[i]))
    return finish_bm(bm, m, M)

def halfdisc(r, depth, m, M, segs=8):
    """A half disc (flat side down) in the XZ plane, extruded along Y: an arch top."""
    pts = [(r * math.cos(PI * i / segs), r * math.sin(PI * i / segs)) for i in range(segs + 1)]
    return prism(pts, depth, m, M)

def ring(r0, r1, h, m, M, segs=24, start=0.0, sweep=2 * PI):
    """An annulus (r0..r1) round Z, h tall, centred at z = 0; a partial sweep is an arch."""
    bm = bmesh.new(); rows = []
    full = abs(sweep - 2 * PI) < 1e-6
    count = segs if full else segs + 1
    for k in range(count):
        t = start + sweep * k / segs; c, s = math.cos(t), math.sin(t)
        rows.append([bm.verts.new((r0 * c, r0 * s, -h / 2)), bm.verts.new((r1 * c, r1 * s, -h / 2)),
                     bm.verts.new((r1 * c, r1 * s, h / 2)), bm.verts.new((r0 * c, r0 * s, h / 2))])
    for k in range(segs):
        a, b = rows[k], rows[(k + 1) % count]
        for j in range(4):
            bm.faces.new((a[j], b[j], b[(j + 1) % 4], a[(j + 1) % 4]))
    if not full:
        bm.faces.new(rows[0]); bm.faces.new(rows[-1][::-1])
    return finish_bm(bm, m, M)

def rot2(x, y, t):
    c, s = math.cos(t), math.sin(t)
    return x * c - y * s, x * s + y * c

# Shared bits of scenery.
def palette():
    return dict(
        GRASS=C("grass", "#6cc35a", 0.9), GRASS2=C("grass_dark", "#57ad4c", 0.9),
        TRUNK=C("trunk", "#8a5a3c", 0.8), LEAF=C("leaf", "#4caf50", 0.8), LEAF2=C("leaf_light", "#7bd35e", 0.8),
        WOOD=C("wood", "#b07a4a", 0.8), WHITE=C("white", "#f4f2ee", 0.6), PAVE=C("paving", "#d9d2c5", 0.85),
        DARK=C("dark", "#3a3f4a", 0.6), METAL=C("steel", "#8a90a0", 0.4, 0.5),
    )

def tree(x, y, s, P, kind=0):
    cyl(0.18 * s, 1.2 * s, x, y, 0.6 * s + 0.2, P["TRUNK"], 6)
    if kind == 0:
        ball(0.95 * s, x, y, 1.75 * s + 0.2, P["LEAF"] if (int(x * 7 + y * 3) % 2) else P["LEAF2"], 1)
    else:
        cyl(0.9 * s, 1.8 * s, x, y, 1.9 * s + 0.2, P["LEAF"], 7, 0.0)

def bush(x, y, s, P):
    ball(0.55 * s, x, y, 0.2 + 0.3 * s, P["LEAF2"], 1, 0.75)

def bench(x, y, rz, P):
    for (lx, ly, lz, sx, sy, sz) in [(0, 0, 0.62, 1.6, 0.5, 0.1), (0, 0.24, 0.95, 1.6, 0.08, 0.45)]:
        px, py = rot2(lx, ly, rz); box(sx, sy, sz, x + px, y + py, lz, P["WOOD"], rz)
    for lx in (-0.65, 0.65):
        px, py = rot2(lx, 0, rz); box(0.1, 0.45, 0.4, x + px, y + py, 0.4, P["DARK"], rz)

# ---- The models -----------------------------------------------------------------------
def build_clocktower():
    P = palette()
    STONE = C("stone", "#e8d3a8", 0.85); STONE2 = C("stone_trim", "#cdb487", 0.85); STONE3 = C("stone_base", "#b9a27c", 0.85)
    SLATE = C("slate", "#4f5f8f", 0.6); GOLD = C("gold", "#f2c230", 0.35, 0.6)
    FACE = C("clockface", "#fff6dc", 0.4, 0.0, 1.5); DOOR = C("door", "#7a4a2e", 0.7)
    BRONZE = C("bell", "#d9a23a", 0.35, 0.7); PLAZA = C("plaza", "#e3dccd", 0.85)
    FLOW = [C(f"flower{i}", c, 0.7) for i, c in enumerate(["#ff5f6d", "#ffd23a", "#ff8ad8", "#ffffff"])]
    SOIL = C("soil", "#7a5236", 0.9)
    # Lot: grass with a stone plaza and a path to the front.
    box(16, 16, 0.2, 0, 0, 0.1, P["GRASS"])
    box(11, 11, 0.06, 0, 0, 0.23, PLAZA)
    box(3, 2.4, 0.06, 0, -6.7, 0.23, PLAZA)
    # Tower: plinth, shaft with corner pilasters and bands.
    box(5.4, 5.4, 1.0, 0, 0, 0.76, STONE3)
    box(5.8, 5.8, 0.2, 0, 0, 1.3, STONE2)
    box(4.0, 4.0, 11.8, 0, 0, 7.3, STONE)
    for cx in (-1, 1):
        for cy in (-1, 1):
            box(0.6, 0.6, 11.8, cx * 1.85, cy * 1.85, 7.3, STONE2)
    for z in (6.0, 10.2):
        box(4.5, 4.5, 0.3, 0, 0, z, STONE2)
    for k in range(4):
        rz = k * PI / 2
        # Door (front) or tall arched windows (sides), each a slab and a half-disc top.
        if k == 0:
            x, y = rot2(0, -2.04, rz); box(1.4, 0.1, 2.2, x, y, 2.5, DOOR, rz)
            halfdisc(0.7, 0.1, DOOR, place(x, y, 3.6, rz))
            x, y = rot2(0, -2.06, rz); box(1.7, 0.1, 0.25, x, y, 1.45, STONE2, rz)
        for wz in (7.6, 11.4):
            x, y = rot2(0, -2.03, rz); box(0.7, 0.08, 1.3, x, y, wz, P["DARK"], rz)
            halfdisc(0.35, 0.08, P["DARK"], place(x, y, wz + 0.65, rz), 4)
    # Clock stage: a wider block, a clock face on every side.
    box(4.6, 4.6, 0.35, 0, 0, 13.25, STONE2)
    box(4.4, 4.4, 4.0, 0, 0, 15.4, STONE)
    for k in range(4):
        rz = k * PI / 2
        x, y = rot2(0, -2.25, rz); cyl(1.45, 0.12, x, y, 15.4, FACE, 12, rz=rz, rx=PI / 2)
        x, y = rot2(0, -2.27, rz); ring(1.45, 1.72, 0.2, GOLD, place(x, y, 15.4, rz, PI / 2), 12)
        # Hands: ten past ten.
        for ang, L, w in ((PI / 2 + 1.05, 1.15, 0.12), (PI / 2 - 1.0, 0.8, 0.16)):
            ex, ez = math.cos(ang) * L, math.sin(ang) * L
            a0x, a0y = rot2(0, -2.36, rz); a1x, a1y = rot2(ex, -2.36, rz)
            beam((a0x, a0y, 15.4), (a1x, a1y, 15.4 + ez), w, 0.05, P["DARK"])
        x, y = rot2(0, -2.38, rz); cyl(0.13, 0.06, x, y, 15.4, GOLD, 6, rz=rz, rx=PI / 2)
    box(4.9, 4.9, 0.4, 0, 0, 17.6, STONE2)
    # Open belfry: corner pillars, arches over the openings, and the bell hanging inside.
    for cx in (-1, 1):
        for cy in (-1, 1):
            box(0.8, 0.8, 3.0, cx * 1.8, cy * 1.8, 19.3, STONE)
    box(4.3, 4.3, 0.2, 0, 0, 17.9, STONE2)
    for k in range(4):
        rz = k * PI / 2
        x, y = rot2(0, -1.8, rz)
        ring(1.05, 1.45, 0.5, STONE, place(x, y, 19.0, rz, PI / 2), 8, 0, PI)  # a half-ring arch
        for sx in (-1, 1):  # spandrels: fill above the arch's sides
            px, py = rot2(sx * 1.225, -1.8, rz); box(0.45, 0.44, 0.5, px, py, 20.15, STONE, rz)
        px, py = rot2(0, -1.8, rz); box(2.9, 0.6, 0.5, px, py, 20.55, STONE, rz)
    box(5.0, 5.0, 0.4, 0, 0, 21.0, STONE2)
    cyl(0.95, 1.3, 0, 0, 19.25, BRONZE, 10, 0.45)
    ball(0.22, 0, 0, 18.5, BRONZE)
    box(0.2, 0.2, 0.9, 0, 0, 20.3, P["DARK"])
    # Pointed slate roof and gold finial.
    cyl(3.6, 5.2, 0, 0, 23.8, SLATE, 4, 0.0, rz=PI / 4)
    cyl(0.07, 1.4, 0, 0, 26.9, GOLD, 6)
    ball(0.28, 0, 0, 26.5, GOLD)
    ball(0.16, 0, 0, 27.6, GOLD)
    # Plaza: benches, lamps, trees, flower beds.
    for k in range(4):
        rz = k * PI / 2
        x, y = rot2(-3.6, -4.2, rz); bench(x, y, rz, P)
        x, y = rot2(3.6, -4.2, rz); bench(x, y, rz, P)
        x, y = rot2(4.7, -4.7, rz)
        cyl(0.08, 2.8, x, y, 1.66, P["DARK"], 6); box(0.3, 0.3, 0.2, x, y, 3.1, P["DARK"])
        ball(0.28, x, y, 3.42, FACE)
        x, y = rot2(6.6, -6.6, rz); tree(x, y, 1.15, P, k % 2)
        # Flower beds along the plaza edge, either side of each path.
        for sx in (-1, 1):
            bx, by = rot2(sx * 3.2, -6.4, rz)
            box(3.2, 1.1, 0.35, bx, by, 0.37, SOIL, rz)
            for f in range(3):
                fx, fy = rot2(sx * 3.2 - 1.0 + f * 1.0, -6.4 + (0.2 if f % 2 else -0.2), rz)
                box(0.32, 0.32, 0.32, fx, fy, 0.66, FLOW[(f + k + (sx > 0)) % 4], rz + PI / 4)
        if k:
            x, y = rot2(0, -6.6, rz); bush(x - 0.0, y, 1.3, P)

def build_lighthouse():
    P = palette()
    WATER = C("water", "#4fc3f7", 0.3); SAND = C("sand", "#f5d98b", 0.9); ROCK = C("rock", "#9aa0a8", 0.9)
    RED = C("red", "#e2463a", 0.6); WHITE = P["WHITE"]; LAMP = C("lamp", "#ffe680", 0.2, 0.0, 3.0)
    ROOF = C("roof_red", "#c93a30", 0.6); BOAT = C("boat", "#ffb13b", 0.6); BLUE = C("boat_blue", "#3f7fe0", 0.6)
    PLANK = C("plank", "#a8754a", 0.8)
    box(16, 16, 0.3, 0, 0, 0.15, WATER)
    # Sandy islet (a soft blob of two discs), rocks round the tower's foot.
    cyl(5.6, 0.5, -0.8, 1.2, 0.4, SAND, 14).scale = (1, 1, 1)
    cyl(4.2, 0.48, 2.4, 2.6, 0.39, SAND, 12)
    cyl(3.6, 0.46, -3.0, -1.4, 0.38, SAND, 12)
    for (x, y, r) in [(-3.6, 0.2, 0.9), (-1.6, -2.4, 0.8), (1.0, -1.6, 0.7), (-4.6, 2.8, 0.8), (-2.2, 4.2, 0.9), (0.4, 5.4, 0.6)]:
        ball(r, x, y, 0.75, ROCK, 1, 0.7)
    TX, TY = -1.6, 1.0
    cyl(2.3, 0.9, TX, TY, 1.05, ROCK, 10)
    # Tower in red and white stripes, tapering.
    z, r = 1.5, 1.8
    for i in range(4):
        h = 3.0; r2 = r - 0.054 * h
        cyl(r, h, TX, TY, z + h / 2, RED if i % 2 == 0 else WHITE, 12, r2)
        z += h; r = r2
    # Door and little windows.
    halfdisc(0.5, 0.2, P["DARK"], place(TX, TY - 1.72, 2.85, 0, 0, 0))
    box(1.0, 0.2, 1.3, TX, TY - 1.72, 2.2, P["DARK"], rx=-0.05)
    for wz in (5.6, 8.6, 11.4):
        box(0.4, 0.2, 0.6, TX, TY - (1.8 - 0.054 * (wz - 1.5)) + 0.02, wz, P["DARK"])
    # Gallery with a rail, the glowing lamp room, and the red roof.
    cyl(1.75, 0.3, TX, TY, 13.65, WHITE, 16)
    for k in range(10):
        a = 2 * PI * k / 10
        cyl(0.05, 0.6, TX + 1.6 * math.cos(a), TY + 1.6 * math.sin(a), 14.1, P["DARK"], 4)
    ring(1.52, 1.68, 0.1, P["DARK"], place(TX, TY, 14.4), 16)
    cyl(0.95, 0.2, TX, TY, 13.9, P["DARK"], 10)
    cyl(0.85, 1.4, TX, TY, 14.7, LAMP, 10)
    for k in range(5):
        a = 2 * PI * k / 5 + 0.3
        box(0.12, 0.12, 1.4, TX + 0.88 * math.cos(a), TY + 0.88 * math.sin(a), 14.7, RED, a)
    cyl(1.15, 0.2, TX, TY, 15.5, ROOF, 12)
    cyl(1.1, 1.4, TX, TY, 16.3, ROOF, 12, 0.08)
    ball(0.2, TX, TY, 17.05, P["DARK"])
    # Keeper's cottage, with a gabled roof and chimney.
    HX, HY = 3.0, 3.4
    box(3.6, 2.6, 2.0, HX, HY, 1.6, WHITE)
    prism([(-1.55, 0), (1.55, 0), (0, 1.3)], 4.0, ROOF, place(HX, HY, 2.6, PI / 2))
    box(0.4, 0.4, 1.2, HX + 1.0, HY + 0.5, 3.6, RED)
    box(0.7, 0.1, 1.3, HX - 0.6, HY - 1.32, 1.25, P["DARK"])
    for wx in (0.5, 1.3):
        box(0.5, 0.1, 0.5, HX + wx, HY - 1.32, 1.75, C("glass", "#9fd4ff", 0.15, 0.2))
    # Jetty out to the right, and a little boat moored to it.
    box(1.4, 5.6, 0.2, 4.6, -3.6, 0.85, PLANK)
    for py in (-1.6, -3.6, -5.6):
        for px in (3.95, 5.25):
            cyl(0.1, 1.0, px, py, 0.5, P["TRUNK"], 5)
    hull = [(-1.4, 0.35), (1.4, 0.35), (1.9, 1.0), (-1.7, 1.0)]
    prism(hull, 1.3, BOAT, place(6.85, -4.6, 0, PI / 2))
    box(1.1, 1.3, 0.12, 6.85, -4.6, 1.0, WHITE)
    box(0.9, 0.8, 0.6, 6.85, -4.2, 1.3, BLUE)
    # A few trees and bushes on the islet.
    tree(-4.4, 4.6, 0.9, P, 1); tree(0.8, 5.8, 0.8, P, 0); tree(5.6, 5.0, 0.85, P, 1)
    bush(-3.8, -2.6, 0.9, P); bush(1.2, 1.4, 0.8, P)

HUB = 8.3
def build_ferris_base():
    P = palette()
    BLUE = C("frame_blue", "#3f7fe0", 0.5, 0.3); RED = C("stripe_red", "#ff5f6d", 0.6)
    YEL = C("yellow", "#ffd23a", 0.6); PLAT = C("deck", "#d8c7a6", 0.8); PATH = C("path", "#e3dccd", 0.85)
    box(16, 16, 0.2, 0, 0, 0.1, P["GRASS"])
    box(2.6, 4.7, 0.04, 0, -5.45, 0.22, PATH)
    box(9.0, 3.2, 0.04, 0, -1.5, 0.22, PATH)
    # Boarding platform under the wheel and its steps.
    box(5.0, 2.2, 0.45, 0, 0, 0.42, PLAT)
    for i, h in enumerate((0.3, 0.15)):
        box(1.8, 0.45, h, 0, -1.32 - 0.45 * i, 0.22 + h / 2, PLAT)
    box(4.9, 0.08, 0.5, 0, 1.0, 0.9, P["WHITE"])
    # A-frame legs (front and back), braces and the axle.
    for y in (-1.45, 1.45):
        for sx in (-1, 1):
            beam((sx * 4.7, y, 0.2), (0, y, HUB + 0.3), 0.36, 0.3, BLUE)
            box(0.8, 0.7, 0.3, sx * 4.75, y, 0.35, P["DARK"])
        beam((-2.6, y, 3.6), (2.6, y, 3.6), 0.22, 0.2, BLUE)
        beam((-1.25, y, 6.2), (1.25, y, 6.2), 0.2, 0.2, BLUE)
    for sx in (-1, 1):
        beam((sx * 2.6, -1.45, 3.6), (sx * 2.6, 1.45, 3.6), 0.2, 0.2, BLUE)
    cyl(0.32, 3.6, 0, 0, HUB, P["METAL"], 10, rx=PI / 2)
    for y in (-1.45, 1.45):
        cyl(0.55, 0.35, 0, y, HUB, BLUE, 10, rx=PI / 2)
    # Striped ticket booth.
    bx, by = -4.6, -4.6
    for i in range(4):
        box(0.45, 1.8, 2.0, bx - 0.675 + 0.45 * i, by, 1.2, RED if i % 2 == 0 else P["WHITE"])
    box(1.2, 0.08, 0.7, bx, by - 0.92, 1.55, C("glass", "#9fd4ff", 0.15, 0.2))
    box(1.4, 0.4, 0.1, bx, by - 1.0, 1.15, P["WOOD"])
    cyl(1.55, 0.9, bx, by, 2.65, RED, 4, 0.1, rz=PI / 4)
    ball(0.15, bx, by, 3.15, YEL)
    # Gate arch at the front with a sign.
    for sx in (-1, 1):
        cyl(0.22, 3.0, sx * 1.6, -7.2, 1.7, RED, 8)
        ball(0.3, sx * 1.6, -7.2, 3.35, YEL)
    ring(1.38, 1.82, 0.4, YEL, place(0, -7.2, 3.1, 0, PI / 2), 10, 0, PI)
    box(2.0, 0.12, 0.55, 0, -7.2, 3.6, BLUE)
    # White fence round the lot (open at the gate).
    E = 7.75
    for (x0, x1, y0, y1) in [(-E, -1.9, -E, -E), (1.9, E, -E, -E), (-E, E, E, E), (-E, -E, -E, E), (E, E, -E, E)]:
        L = math.hypot(x1 - x0, y1 - y0); rz = math.atan2(y1 - y0, x1 - x0)
        for zz in (0.55, 0.95):
            box(L, 0.08, 0.1, (x0 + x1) / 2, (y0 + y1) / 2, zz, P["WHITE"], rz)
        n = max(1, int(L / 1.4))
        for i in range(n + 1):
            box(0.14, 0.14, 1.0, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 0.6, P["WHITE"])
    # Trees and bushes.
    for (x, y, s, k) in [(-6.3, 6.2, 1.1, 0), (6.3, 6.2, 1.0, 1), (6.4, -5.6, 1.0, 0), (-6.6, 1.0, 0.9, 1), (6.6, 1.6, 0.85, 0)]:
        tree(x, y, s, P, k)
    for (x, y) in [(-3.0, -6.6), (3.0, -6.6), (-2.6, 5.6), (2.6, 5.6), (4.6, -3.4)]:
        bush(x, y, 1.0, P)

def build_ferris_wheel():
    """The wheel alone, hub at the origin, axle along Blender Y (three.js Z)."""
    P = palette()
    RIM = C("rim_white", "#f4f2ee", 0.5); SPOKE = C("spoke", "#3f7fe0", 0.5, 0.3)
    HUBC = C("hub_yellow", "#ffd23a", 0.5)
    CAB = [C(f"cabin{i}", c, 0.55) for i, c in enumerate(["#ff5f6d", "#ffd23a", "#4f8bff", "#5ee0a0", "#ff8ad8"])]
    RC = 6.608
    for y in (-0.75, 0.75):
        ring(RC - 0.12, RC + 0.12, 0.16, RIM, place(0, y, 0, 0, PI / 2), 30)
        ring(3.2, 3.42, 0.14, RIM, place(0, y, 0, 0, PI / 2), 20)
        for k in range(10):
            t = PI / 2 + 2 * PI * k / 10 + PI / 10
            beam((0.5 * math.cos(t), y, 0.5 * math.sin(t)), ((RC - 0.1) * math.cos(t), y, (RC - 0.1) * math.sin(t)), 0.12, 0.1, SPOKE)
    cyl(0.75, 1.9, 0, 0, 0, HUBC, 12, rx=PI / 2)
    cyl(0.4, 2.1, 0, 0, 0, RIM, 10, rx=PI / 2)
    for k in range(10):
        t = PI / 2 + 2 * PI * k / 10
        cx, cz = RC * math.cos(t), RC * math.sin(t)
        cyl(0.07, 1.5, cx, 0, cz, P["DARK"], 6, rx=PI / 2)
        cyl(0.8, 1.0, cx, 0, cz, CAB[k % 5], 10, rx=PI / 2)
        for y in (-0.53, 0.53):
            cyl(0.84, 0.08, cx, y, cz, RIM, 10, rx=PI / 2)

def build_airport():
    P = palette()
    ASPH = C("asphalt", "#4a4f5a", 0.9); LINE = C("lines", "#ffffff", 0.6); APRON = C("apron", "#c9c4bc", 0.85)
    TERM = C("terminal", "#f4f2ee", 0.5); GLASS = C("glass", "#7cc4ff", 0.15, 0.2); CANOPY = C("canopy", "#4f8bff", 0.5)
    HANG = C("hangar", "#a9b4c2", 0.5, 0.3); HANG2 = C("hangar_door", "#6f7a8a", 0.6, 0.2)
    TOWER = C("tower", "#e8e4dc", 0.6); RED = C("red", "#ff5f6d", 0.6); YEL = C("yellow", "#ffd23a", 0.6)
    ORANGE = C("windsock", "#ff8a3c", 0.6); PLANE = C("plane_white", "#ffffff", 0.4); PLANEB = C("plane_blue", "#3f7fe0", 0.5)
    box(16, 16, 0.2, 0, 0, 0.1, P["GRASS"])
    # Runway along the front, with its markings.
    box(15.9, 3.0, 0.06, 0, -5.6, 0.23, ASPH)
    for i in range(7):
        box(1.0, 0.16, 0.02, -6.0 + i * 2.0, -5.6, 0.27, LINE)
    for ex in (-7.5, 7.5):
        for j in range(5):
            box(0.6, 0.18, 0.02, ex, -6.6 + j * 0.5, 0.27, LINE)
    box(15.7, 0.08, 0.02, 0, -6.95, 0.27, LINE); box(15.7, 0.08, 0.02, 0, -4.25, 0.27, LINE)
    # Taxiway and apron.
    box(1.4, 1.2, 0.06, 4.4, -3.6, 0.23, ASPH)
    box(15.6, 4.6, 0.05, 0, -0.75, 0.225, APRON)
    for i in range(3):
        box(0.08, 4.0, 0.02, -5.5 + i * 2.6, -0.75, 0.26, YEL)
    # Drop-off road along the back, with a kerb.
    box(15.9, 1.5, 0.05, 0, 7.15, 0.225, ASPH)
    for i in range(7):
        box(0.9, 0.1, 0.02, -6 + i * 2, 7.15, 0.26, LINE)
    box(15.8, 0.2, 0.15, 0, 6.3, 0.27, APRON)
    # Terminal: glass front, a blue canopy over it, and a roof.
    box(8.0, 4.4, 2.6, -3.2, 3.9, 1.5, TERM)
    box(7.4, 0.08, 1.7, -3.2, 1.67, 1.3, GLASS)
    for i in range(6):
        box(0.12, 0.12, 1.75, -6.9 + i * 1.48, 1.64, 1.32, TERM)
    box(8.4, 4.8, 0.25, -3.2, 3.9, 2.9, CANOPY)
    box(8.4, 1.1, 0.12, -3.2, 1.1, 2.25, CANOPY)
    for x in (-6.9, -3.2, 0.5):
        cyl(0.06, 2.0, x, 0.65, 1.25, P["DARK"], 6)
    box(2.2, 0.08, 0.5, -3.2, 1.68, 2.45, YEL)
    box(1.6, 0.08, 1.3, -3.2, 6.13, 0.85, GLASS)  # back doors to the road
    # Control tower with its glass cab.
    TX, TY = 2.4, 5.0
    cyl(0.6, 7.0, TX, TY, 3.7, TOWER, 8, 0.5)
    cyl(1.1, 0.3, TX, TY, 7.25, TOWER, 8)
    cyl(1.25, 1.3, TX, TY, 8.05, GLASS, 8, 1.4)
    cyl(1.55, 0.3, TX, TY, 8.85, P["DARK"], 8)
    cyl(0.04, 1.2, TX, TY, 9.6, P["DARK"], 4); ball(0.12, TX, TY, 10.2, RED)
    # Hangar with a rounded roof, open to the apron.
    HX, HY = 5.7, 4.3
    box(3.6, 4.0, 1.2, HX, HY, 0.8, HANG)
    halfdisc(1.8, 4.0, HANG, place(HX, HY, 1.4), 10)
    box(2.8, 0.08, 1.6, HX, HY - 2.02, 1.0, HANG2)
    halfdisc(1.4, 0.08, HANG2, place(HX, HY - 2.02, 1.8), 8)
    # The plane: a small high-wing twin-prop on the apron.
    PX, PY, PZ = -1.0, -1.35, 1.15
    cyl(0.48, 4.4, PX, PY, PZ, PLANE, 8, ry=PI / 2)
    cyl(0.48, 0.9, PX + 2.65, PY, PZ - 0.05, PLANE, 8, 0.18, ry=PI / 2)
    cyl(0.48, 1.4, PX - 2.9, PY, PZ + 0.12, PLANE, 8, 0.12, ry=-PI / 2)
    box(4.4, 0.06, 0.18, PX, PY - 0.47, PZ + 0.05, PLANEB); box(4.4, 0.06, 0.18, PX, PY + 0.47, PZ + 0.05, PLANEB)
    box(0.5, 0.06, 0.25, PX + 1.8, PY - 0.46, PZ + 0.25, GLASS); box(0.5, 0.06, 0.25, PX + 1.8, PY + 0.46, PZ + 0.25, GLASS)
    box(1.2, 5.4, 0.14, PX + 0.4, PY, PZ + 0.52, PLANE)
    for sy in (-1, 1):
        cyl(0.24, 1.3, PX + 0.95, PY + sy * 1.6, PZ + 0.3, PLANEB, 8, ry=PI / 2)
        box(0.06, 1.3, 0.14, PX + 1.62, PY + sy * 1.6, PZ + 0.3, P["DARK"])
        box(0.12, 0.12, 0.8, PX + 0.4, PY + sy * 0.9, PZ - 0.55, P["DARK"])
        ball(0.18, PX + 0.4, PY + sy * 0.9, 0.42, P["DARK"])
    box(0.12, 0.12, 0.5, PX + 2.1, PY, 0.65, P["DARK"]); ball(0.14, PX + 2.1, PY, 0.38, P["DARK"])
    prism([(-0.6, 0), (0.3, 0), (0.05, 1.3), (-0.45, 1.3)], 0.1, RED, place(PX - 3.15, PY, PZ + 0.35))
    box(0.7, 2.2, 0.08, PX - 3.3, PY, PZ + 0.45, PLANE)
    # A little baggage tug with a cart.
    box(0.9, 0.6, 0.5, 2.2, 0.3, 0.5, YEL); box(0.4, 0.5, 0.35, 2.05, 0.3, 0.92, GLASS)
    box(1.2, 0.8, 0.12, 3.4, 0.3, 0.45, P["DARK"])
    for i, c in enumerate((RED, PLANEB)):
        box(0.5, 0.5, 0.4, 3.1 + i * 0.6, 0.3, 0.71, c)
    # Windsock beside the runway; trees and bushes.
    cyl(0.05, 2.4, 6.2, -3.5, 1.4, P["WHITE"], 5)
    for i in range(3):
        cyl(0.24 - i * 0.04, 0.45, 6.4 + i * 0.45, -3.5, 2.45, ORANGE if i % 2 == 0 else P["WHITE"], 8, 0.2 - i * 0.04, ry=PI / 2)
    for (x, y, s, k) in [(-7.0, 2.4, 0.8, 0), (7.1, 1.6, 0.75, 1), (0.4, 2.4, 0.6, 0)]:
        tree(x, y, s, P, k)
    for (x, y) in [(-7.2, 5.6), (3.8, 2.3), (7.3, 5.6)]:
        bush(x, y, 0.8, P)

BUILD = dict(clocktower=build_clocktower, lighthouse=build_lighthouse, ferris_base=build_ferris_base,
             ferris_wheel=build_ferris_wheel, airport=build_airport)

# ---- Join, bake, export, preview ----------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats.clear(); objs.clear()

def finish(name):
    """Join this model's parts into one mesh and bake soft shadows into its vertex colours."""
    scene = bpy.context.scene
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object; ob.name = name
    objs.clear()
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.001); bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_flat()
    scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"; scene.cycles.samples = 32
    if not scene.world:
        scene.world = bpy.data.worlds.new("w"); scene.world.color = (1, 1, 1)
    attr = ob.data.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    ob.data.color_attributes.active_color = attr
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO")
    for c in attr.data:
        k = 0.55 + 0.45 * c.color[0]
        c.color = (k, k, k, 1)
    return ob

def show_ao():
    """For the preview only: multiply each material by the baked shading, as the game shows it."""
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        nt = m.node_tree; b = nt.nodes["Principled BSDF"]
        if b.inputs["Base Color"].is_linked: continue
        a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_name = "AO"
        mul = nt.nodes.new("ShaderNodeVectorMath"); mul.operation = "MULTIPLY"
        mul.inputs[0].default_value = b.inputs["Base Color"].default_value[:3]
        nt.links.new(a.outputs["Color"], mul.inputs[1])
        nt.links.new(mul.outputs["Vector"], b.inputs["Base Color"])

def preview(path, height, target_z=None, scale=None):
    scene = bpy.context.scene
    show_ao()
    tz = height * 0.42 if target_z is None else target_z
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); cam.data.type = "ORTHO"
    cam.data.ortho_scale = scale or max(25.0, 14.0 + height * 0.85)
    cam.location = (30, -30, 26 + tz); scene.collection.objects.link(cam); scene.camera = cam
    cam.rotation_euler = (Vector((0, 0, tz)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 500
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN")); sun.data.energy = 3
    sun.rotation_euler = (0.8, 0.2, 0.6); scene.collection.objects.link(sun)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.82, 0.9, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.render.resolution_x = scene.render.resolution_y = 720
    scene.cycles.samples = 24
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

def make(name):
    reset()
    BUILD[name]()
    ob = finish(name)
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector([min(v[i] for v in bb) for i in range(3)]); hi = Vector([max(v[i] for v in bb) for i in range(3)])
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"[{name}] min {tuple(round(v, 3) for v in lo)} max {tuple(round(v, 3) for v in hi)} triangles {tris}")
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(here, name + ".glb"), export_format="GLB", use_selection=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_apply=True, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, name + ".blend"))
    if name == "ferris_wheel":
        preview(os.path.join(here, name + "-preview.png"), 0, 0, 20)
    else:
        preview(os.path.join(here, name + "-preview.png"), hi.z)

def ferris_check():
    """The base and the wheel together, as the game puts them (hub HUB units up)."""
    reset()
    build_ferris_base(); finish("ferris_base")
    build_ferris_wheel(); w = finish("ferris_wheel"); w.location.z = HUB
    preview(os.path.join(here, "ferris-preview.png"), HUB + 7.5)

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    names = [a for a in argv if a in BUILD or a == "ferris"] or list(BUILD) + ["ferris"]
    for n in names:
        if n == "ferris": ferris_check()
        else: make(n)
