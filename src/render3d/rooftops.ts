// Rooftops for finished towers: the taller the tower, the grander its top. A short tower
// gets an antenna, then a roof garden, a helipad, a glass spire and, for the tallest, a
// golden crown. Each sits on the top floor, sized to fit it.
import * as THREE from "three";

export type RoofKind = "antenna" | "garden" | "helipad" | "spire" | "crown";

/** Which rooftop a tower of `floors` floors earns. */
export function roofFor(floors: number): RoofKind {
  if (floors >= 70) return "crown";
  if (floors >= 45) return "spire";
  if (floors >= 25) return "helipad";
  if (floors >= 10) return "garden";
  return "antenna";
}

/** Floors needed for each rooftop, smallest first (for "next rooftop at N floors"). */
export const ROOF_STEPS: [number, RoofKind][] = [[0, "antenna"], [10, "garden"], [25, "helipad"], [45, "spire"], [70, "crown"]];

const mat = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

/** A blinking light; the renderer flashes every mesh marked `blink`. */
function beacon(y: number, color = 0xff3030, r = 0.22): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8).translate(0, y, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5 }));
  m.userData.blink = true;
  return m;
}

/**
 * A rooftop of the given kind, centered on the origin with its base at y = 0. `half` is
 * the half-size of the largest square that fits on the roof.
 */
export function buildRoof(kind: RoofKind, half: number): THREE.Group {
  const g = new THREE.Group(), s = Math.max(0.6, Math.min(half, 3.2));
  const steel = mat(0xe9ecef, { metalness: 0.7, roughness: 0.25 });
  if (kind === "antenna") {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.9, 0.9, s * 0.9).translate(0, 0.45, 0), mat(0xbec6d2, { roughness: 0.7 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6).translate(0, 3.4, 0), steel));
    g.add(beacon(6));
  } else if (kind === "garden") {
    // A planted roof: a lawn bed, little trees and a pergola.
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.7, 0.3, s * 1.7).translate(0, 0.15, 0), mat(0x8a6a4a)));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, 0.06, s * 1.6).translate(0, 0.33, 0), mat(0x5fbf5a, { roughness: 0.95 })));
    const leaf = [0x4caf50, 0x66bb6a, 0x81c784];
    const spots = [[-0.55, -0.55], [0.55, -0.5], [-0.5, 0.55], [0.6, 0.6], [0, 0]];
    spots.forEach(([x, z], i) => {
      const k = i === 4 ? 1.25 : 0.85;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6 * k, 5).translate(x * s, 0.6 * k, z * s), mat(0x7a5a3a)));
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * k * Math.min(1, s / 1.6), 0).translate(x * s, 1.05 * k, z * s), mat(leaf[i % 3], { flatShading: true, roughness: 0.9 })));
    });
    const flowers = [0xff6b6b, 0xffd43b, 0xf783ac, 0xb197fc];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4).translate(Math.cos(a) * s * 0.78, 0.42, Math.sin(a) * s * 0.78), mat(flowers[i % 4])));
    }
  } else if (kind === "helipad") {
    const pad = document.createElement("canvas");
    pad.width = pad.height = 256;
    const c = pad.getContext("2d")!;
    c.fillStyle = "#2b2f3a"; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "#ffd43b"; c.lineWidth = 14;
    c.beginPath(); c.arc(128, 128, 104, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#ffffff"; c.font = "900 150px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("H", 128, 136);
    const tex = new THREE.CanvasTexture(pad);
    tex.userData.own = true; // freed with the rooftop
    tex.colorSpace = THREE.SRGBColorSpace;
    const r = s * 0.92;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.6, 12).translate(0, 0.3, 0), mat(0x9aa3b0)));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 32).translate(0, 0.69, 0), [mat(0x495057), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), mat(0x495057)]);
    g.add(top);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4).translate(Math.cos(a) * r * 0.97, 0.82, Math.sin(a) * r * 0.97), new THREE.MeshStandardMaterial({ color: 0x8ce99a, emissive: 0x40c057, emissiveIntensity: 2 }));
      g.add(l);
    }
  } else if (kind === "spire") {
    // Stepped glass crown and a needle, like the great skyscrapers.
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, metalness: 0.9, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 });
    let y = 0, w = s * 1.5;
    for (let i = 0; i < 4; i++) {
      const h = 0.9 - i * 0.12;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0), i % 2 ? steel : glass));
      y += h; w *= 0.7;
    }
    g.add(new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, 2.2, 4).rotateY(Math.PI / 4).translate(0, y + 1.1, 0), glass));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 4.5, 6).translate(0, y + 2.2 + 2.25, 0), steel));
    g.add(beacon(y + 6.8, 0xffffff, 0.2));
  } else {
    // A golden crown: a ring of tall points around a glowing gem. The gold glows a little,
    // so it still reads at night.
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc94a, emissive: 0x6a4200, emissiveIntensity: 0.9, metalness: 1, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.8 });
    const r = s * 0.9;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 1.2, 32, 1, true).translate(0, 0.6, 0), gold));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 32).rotateX(Math.PI / 2).translate(0, 1.2, 0), gold));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, tall = i % 2 ? 1.8 : 2.8;
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.38, tall, 6).translate(Math.cos(a) * r, 1.2 + tall / 2, Math.sin(a) * r), gold));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6).translate(Math.cos(a) * r, 1.25 + tall, Math.sin(a) * r), gold));
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0).scale(1, 1.5, 1).translate(0, 2.8, 0),
      new THREE.MeshPhysicalMaterial({ color: 0xff4f8b, emissive: 0xff2a6a, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.05, clearcoat: 1 }));
    gem.userData.spin = true;
    g.add(gem);
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}
