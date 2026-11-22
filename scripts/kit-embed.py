"""Embeds src/render3d/kit/*.glb into src/render3d/kitdata.ts (base64), so the game stays one
self-contained file. Run after adding or changing a model: python3 scripts/kit-embed.py"""
import base64, os

d = os.path.join(os.path.dirname(__file__), "..", "src", "render3d", "kit")
names = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".glb"))
out = [
    "// Generated from src/render3d/kit/*.glb (free CC0 models: see src/render3d/kit/NOTICE.md):",
    "// the model files, embedded so the game stays one self-contained file. Regenerate with",
    "// python3 scripts/kit-embed.py after changing the .glb files.",
    "export const KIT_GLB: Record<string, string> = {",
]
for n in names:
    with open(os.path.join(d, n + ".glb"), "rb") as f:
        out.append(f'  {n}: "{base64.b64encode(f.read()).decode()}",')
out.append("};")
with open(os.path.join(d, "..", "kitdata.ts"), "w") as f:
    f.write("\n".join(out) + "\n")
print(len(names), "models")
