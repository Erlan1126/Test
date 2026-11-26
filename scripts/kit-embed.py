"""Embeds src/render3d/kit/*.glb into src/render3d/kitdata.ts (base64), so the game stays one
self-contained file. Run after adding or changing a model: python3 scripts/kit-embed.py

The city game's own landmarks (the "bl_" models made in Blender: stadium, clock tower, ferris
wheel...) go in kitdata-city.ts instead, so the Skyrise build leaves them out: it never shows
them, and they are about a megabyte of the download and of the work done at startup."""
import base64, os

d = os.path.join(os.path.dirname(__file__), "..", "src", "render3d", "kit")
names = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".glb"))
HEAD = [
    "// Generated from src/render3d/kit/*.glb (free CC0 models: see src/render3d/kit/NOTICE.md):",
    "// the model files, embedded so the game stays one self-contained file. Regenerate with",
    "// python3 scripts/kit-embed.py after changing the .glb files.",
]


def write(fname, const, picked, note):
    out = HEAD + note + [f"export const {const}: Record<string, string> = {{"]
    for n in picked:
        with open(os.path.join(d, n + ".glb"), "rb") as f:
            out.append(f'  {n}: "{base64.b64encode(f.read()).decode()}",')
    out.append("};")
    with open(os.path.join(d, "..", fname), "w") as f:
        f.write("\n".join(out) + "\n")


shared = [n for n in names if not n.startswith("bl_")]
city = [n for n in names if n.startswith("bl_")]
write("kitdata.ts", "KIT_GLB", shared, [])
write("kitdata-city.ts", "KIT_GLB_CITY", city, ["// The city game's landmarks only: the Skyrise build leaves this file out."])
print(len(shared), "shared models,", len(city), "city-only models")
