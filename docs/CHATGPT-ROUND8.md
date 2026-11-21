# Skyrise — Round 8: Skyhaven art-direction and visual-quality audit

**Repository:** Erlan1126/Test  
**Reviewed ref:** `claude/skyrise-living-block`  
**Scope:** read-only assessment of `src/render3d/bizcity.ts`, `shaders.ts`, `bizmodels.ts`, `block.ts`, `renderer3d.ts`, `src/ui/tycoon.ts` (`openLand`, `renderCity`), `src/ui/mayor.ts`, `src/styles.css`, and `src/data/land.ts`. Note: the requested `data/land.ts` is actually `src/data/land.ts`.  
**Evidence standard:** static source inspection, not a running screenshot comparison. “Risk” indicates a geometrically plausible artifact requiring camera/device verification, not a reproduced visual bug. Measurements below are world units unless noted.

## Executive direction

Aim for **Skyhaven = a warm, walkable, handcrafted floating seaside town**. Preserve stylized proportions and readable silhouettes; prioritize correct contact, curb continuity, restrained road paint, layered shorelines, and carefully staged expansion reveals. Townscaper suggests coherent forms; Pocket City suggests legibility; Mini Motorways suggests simple, intentional road graphics. Do not copy their assets.

## 1. Specific geometry, overlap, clipping, and depth findings

| Severity | Source location | Evidence and expected artifact | Actionable fix |
|---|---|---|---|
| **High — intersection marking overflow** | `bizcity.ts:387-408` | Zebra loop draws seven bars at lateral offsets `b*0.33` from -0.99 to +0.99, each 0.24 wide, across a 2.4-wide street. Their outer edges reach ±1.11, leaving only 0.09 clearance to the nominal ±1.2 road edge. The same crossing is generated independently on each road arm, so markings crowd intersection corners and nearby curb fillets. | Make crossings one intersection-owned mesh, not per-block decals. Target crossing width 1.65–1.75; bars 0.15–0.18 wide, gap 0.11–0.14; stop bars 0.08 wide; reserve at least 0.25 from curb radius. |
| **High — road paint may sink into asphalt** | `bizcity.ts:373,400-408` | Asphalt box center y=0, thickness 0.1, top y=0.05. The ordinary lane/edge/zebra boxes center at y=0.055, thickness 0.02, so their bottom is 0.045: only 0.005 penetrates road. This is intentional but thin and vulnerable to coarse mobile depth and near-coplanar fragments. Median grass and curb are thicker. | Set decal surfaces to y=0.064–0.07 with thickness 0.008–0.012, or use a single road-surface material with shader markings. Apply polygon offset to paint only if needed; avoid double-painted intersections. |
| **High — bought land has a terrain seam** | `bizcity.ts:151-165, 2090-2120` | `landSpot` moves bought plots from `R+1` outside the coast to `0.75R` past it. The bought branch omits the layered terrain slabs entirely, leaving structures anchored on the original island/overlap instead of a continuous new island top. At attachment boundaries, this can read as a detached or missing foundation. | Union the purchased polygon with the main island outline (or create a shared seam-safe connector mesh), then regenerate continuous grass top, soil band, cliff wall and collision/placement mask. Avoid simply overlapping coplanar top slabs. |
| **High — floating sale sign/fence contact** | `bizcity.ts:2094-2143` | The entire for-sale group is at y=-0.8 plus ±0.12 bob; its top grass is y=0 relative to group. Fence posts and sign are group-local and follow the bob, so they are grounded to that land, but the plot is intentionally floating below the main town. At some camera angles it can appear as a disconnected fragment rather than a clearly offered parcel. | Add a visible warm underside rim, bridge/connection ghost, and a distinct hover shadow; keep props attached to local terrain. Make hover amplitude 0.04–0.06 and slower, with no overlap with coast. |
| **Medium — intersection island conflicts** | `bizcity.ts:410-435` | Roundabouts add a ring at y=0.056 and a curb cylinder from y=0.02 to 0.18, plus grass at y=0.18–0.22. The painted ring is almost coplanar with the road markings and sits very near curb geometry. At approaches, central islands may intersect zebra paint and lane markings. | Exclude crossing/centerline paint within roundabout radius + 0.3. Give the ring a clean surface y≥0.066 and choose either an inset physical curb or painted ring, not both at the same contour. |
| **Medium — sidewalk stack can create abrupt side faces** | `bizcity.ts:62-72, 373-376` | Road top y=0.05, curb slab top y≈0.18 and walk slab top y≈0.20; the two independently rounded extrusions differ in footprint by 0.16. Their vertical profiles are relatively thick for a 2.4-wide street, so curb sides may look like tall block walls and the two rounded outlines may produce harsh concentric corners. | Use one cross-section: asphalt top 0.05; gutter top 0.055; curb top 0.12–0.14; walk top 0.15; bevel 0.025–0.04; corner radius 0.45–0.6. |
| **Medium — rooftop/shop footprint conflict risk** | `bizcity.ts:1450-1480` | HQ lots place a 0.62-scale storefront at local z=1.05 and a tower at z=-1.25; the fitBehind function clamps only z depth, not x footprint or tower/store separation. A store with protruding awnings or props can intersect the tower or adjacent planters. | Compute 2D world-space footprint polygons for shop, HQ, terrace, signs and sidewalks; reserve 0.12 minimum visual clearance and rerun placement after scale changes. |
| **Medium — scaffolding can pierce facade props** | `bizcity.ts:1490-1520` | Scaffolding is bounded from a 3D box but its horizontal half-extent is capped at 1.95. Tall/wide storefronts or animated props may extend beyond it; scaffold bars and planks can pass through signage and awnings. | Use actual local-space bounds plus 0.15 clearance, cap only to legal lot envelope, and hide or reposition colliding facade props while construction is active. |
| **Medium — pool/pond water layering** | `bizcity.ts:465-470, 663-680, 2110+` | Small decorative water disks are cylinders with shallow thickness; their top y values vary across fountain, pond and expansion lake. Without an explicit recessed basin, water can look pasted onto grass or float above it. | Cut a shallow basin into ground or add a 0.07–0.12 raised stone lip, set water top 0.025 below rim, and add an inner dark depth ring. |
| **Medium — island cliff silhouettes** | `bizcity.ts:290-310` | Stacked extrusions shrink in abrupt tiers and stalactite cones are separate geometry. This is stylized, but repeated hard shelves and cone penetrations can look assembled rather than carved. | Replace alternating shelves with 2–3 controlled cliff strata, vertex-color variation, beveled/irregular perimeter, and rocks integrated into underside silhouette. |
| **Medium — animation/ground contact** | `block.ts:141-146,188-189,245-256` | Delivery truck uses y=0.04 while pedestrians/stalls use y≈0.2–0.22. These are independently chosen rather than sampled from a common ground-height function. Road/sidewalk changes can cause tires or feet to sink/hover. | Introduce `surfaceHeight(x,z,kind)` and apply wheel/foot bottom offsets consistently. Validate across street, curb, plaza and expansion land. |
| **Medium — Ferris wheel motion** | `bizcity.ts:2160+` (lakeside branch) | Wheel rotates in z, while cabin counter-rotation is applied to some child BoxGeometry meshes based on position; structural boxes may inadvertently meet that condition. The wheel's support and cabin pivots deserve a dedicated hierarchy. | Create explicit `wheelRotor`, `cabinPivot[]`, `cabinMesh[]`; update pivots to counter-rotate without selecting geometry by type/position. |
| **Low — transparency sorting** | `bizcity.ts:727, 916-945`, `block.ts:169` | Transparent glass, foam, wake and ghost objects use depthWrite=false; overlapping translucent surfaces can sort differently by camera orientation. | Assign stable renderOrder by effect family, keep foam geometry slightly above water, use alphaTest/dither for ghosts if acceptable, and test orbit angles. |

**Already good:** `renderer3d.ts:113-114,817-820` explicitly considers depth precision and applies polygon offset to lawn. `bizcity.ts:439` similarly offsets soft contact shadows. Keep these protections while fixing geometry instead of globally increasing offsets.

**QA requirement:** capture top-down, 35° isometric, low orbit and night/rain screenshots at 1× and 2× DPR, including mobile 16-bit depth devices if available. Use deterministic seeds and all three land states; compare images and record artifacts rather than assuming all risks reproduce.

## 2. Street redesign: “Skyhaven Ribbon Streets”

The existing `ROAD=1.2` half-width in `bizcity.ts:59-60` means 2.4 total road width, but medians, zebra crossings, double centerlines, roundabouts and raised walk slabs all compete for that small space. Use a clear hierarchy and fewer markings.

**Neighborhood street (default):** total asphalt width **2.8**; two travel lanes **1.25** each plus two **0.15** edge gutters. Walkways **0.68** on each side outside the asphalt; curb **0.10** wide, height **0.09** above road. Full corridor **4.36**. If block spacing cannot grow, adopt a compact alternative: asphalt **2.4**, 1.08 lanes + 0.12 gutters, sidewalks **0.5** each, full corridor **3.4**; do not insert a planted median in 2.4.

**Avenue:** asphalt **3.8**, lanes **1.5** each, center planting strip **0.55**, edge gutters **0.125** each. Walkways **0.75** each; full corridor about **5.5** including curbs. Only place avenues where the underlying grid permits this width; otherwise keep neighborhood streets. Trees at least **2.6** apart, inset from junction by **1.5**.

**Corner geometry:** sidewalks should have true rounded fillets, **0.48** radius on local streets, **0.72** on avenues; intersections should be constructed once per grid node using a connected road mesh and continuous sidewalk outlines. Use a slightly larger inner radius for vehicle path turn arcs, **0.7–0.95**, not the current abrupt square crossing geometry. At four-way nodes, choose standard intersections; reserve decorative roundabouts for plazas or a few special landmarks, radius **1.0–1.3** only when enough carriageway exists.

**Markings:** neighborhood centerline optional, warm desaturated ivory `#E9E4D8` 0.045 wide, short dash **0.65** and gap **0.65**. No double-yellow on every residential street. Avenue centerline 0.05 ivory or soft saffron `#D7B96C`. Edge markings 0.035, only near busier streets. Zebra crossings: 5–6 stripes, stripe **0.16**, gap **0.12**, length along road **0.52**, positioned **0.38** before intersection mouth. Stop line **0.07** wide. Do not draw centerlines under zebras or roundabouts.

**Palette:** road `#555B66` dry, `#454F5C` rainy; sidewalk `#E8DCC7`; curb `#D4C4AC`; gutters `#777A7A`; crossings `#F2EAD9`. Prefer a subtle asphalt grain (1–2% luminance), not high-contrast noise. Warm low-poly cobbles only on plaza streets and waterfront paths.

**Visual signature:** every district has a continuous pale sidewalk ribbon, thin warm curb, softly rounded corners, occasional brick inset, flowering tree pits, and restrained painted crossings. Make road geometry a reusable graph-driven builder with shared node IDs and per-edge widths; update `block.ts` pedestrian/vehicle paths and `renderer3d.ts` camera focus only after geometry is authoritative.

## 3. Water and grass — compatible with MeshStandardMaterial.onBeforeCompile

Existing `shaders.ts:160-204` already has multi-octave waves, normals, sky Fresnel, specular glints and crest foam. **Improve rather than replace** it. Current sea depth is a *z-distance from shoreline* (`uFxShore-vFxW.z`), not actual bathymetry; avoid describing it as physically correct depth. `bizcity.ts:284-285` uses a saturated emissive blue water base, which can fight the custom shader's physically lit shading.

**Water materials:** use `MeshStandardMaterial({color:'#FFFFFF', roughness:0.16, metalness:0.0})`; reduce base emissive to near zero, because `shaders.ts` already adds sky/glints to `totalEmissiveRadiance`. Sea shallow `#55C8C4`, middle `#268DAE`, deep `#184B78`; foam `#E8F5E9` at alpha 0.45–0.65. Pools: smaller normal amplitude 0.025–0.045, roughness 0.12–0.2. Ocean: normal amplitude 0.07–0.10 and two wave scales; avoid making the mesh silhouette wildly turbulent.

**Suggested fragment patch**, inserted after `#include <color_fragment>` for diffuse tint and after `#include <emissivemap_fragment>` for foam/glints; reuse existing `vFxW`, `uFxT`, `uFxM`, `uFxShore`, `fxNoise` and `fxWave` definitions. Do not redeclare `depth` in a scope already containing it:

```glsl
float shoreDist = max(0.0, uFxShore - vFxW.z);
float shallowT = smoothstep(0.0, 4.8, shoreDist);
vec3 c0 = vec3(0.33, 0.78, 0.76);
vec3 c1 = vec3(0.12, 0.51, 0.67);
vec3 c2 = vec3(0.06, 0.25, 0.45);
vec3 waterTint = mix(mix(c0, c1, smoothstep(0.0, 0.65, shallowT)),
                     c2, smoothstep(0.5, 1.0, shallowT));
float slowVariation = fxNoise(vFxW.xz * 0.18 + vec2(uFxT * uFxM * 0.018, 0.0));
diffuseColor.rgb *= waterTint * mix(0.95, 1.05, slowVariation);
```

For a **better depth solution**, pass a low-resolution shore-distance/bathymetry texture in world XZ or vertex attribute, not only `vFxW.z`; otherwise irregular coastlines have visibly incorrect color bands. A shallow-edge foam mask can be:

```glsl
float coast = 1.0 - smoothstep(0.12, 0.65, shoreDist);
float breakup = fxNoise(vFxW.xz * 3.2 + vec2(uFxT * uFxM * 0.25, 0.0));
float foam = coast * smoothstep(0.52, 0.74, breakup);
totalEmissiveRadiance += vec3(0.72, 0.86, 0.83) * foam * 0.20;
```

Use a separately drawn narrow shoreline ribbon where the actual coast is curved; do not rely on the z-only mask for all island edges. **Compatibility note:** custom fragment hooks must use existing shared uniform declarations; inject into `color_fragment` before downstream lighting for base color, and avoid double-applying current `shaders.ts:186-202` water tint/emissive. Current code sets `diffuseColor.rgb` after `emissivemap_fragment`, which is late in the StandardMaterial pipeline: move tint to `color_fragment` for reliable participation in lighting.

**Grass:** current `bizcity.ts:279-285` already has two green materials and `shaders.ts:123+` ground noise. Add *large, low-frequency* patchiness, not speckle: `fxNoise(vFxW.xz*0.14)`, with a second `*0.55` octave at 25% weight; vary base color ±6–9% and saturation ±3%. Palette: sunlit `#8ECF78`, base `#75B967`, shade `#5D9D61`, dry path fringe `#B6C77D`. Blend via `diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.82,0.93,0.79), patch*0.14);` inside `color_fragment`. Reserve darker ground for tree roots and building contact shadows; add sparse clover/flower decals as merged or instanced geometry, not thousands of separate meshes. Make wind movement affect grass tufts, not the entire lawn surface.

## 4. Premium land expansion and purchase flow

`src/data/land.ts:1-29` defines Meadow Fields (8 minutes, minimum 15,000), Lakeside (20 minutes, minimum 400,000), and Hillside Homes (35 minutes, minimum 8,000,000), each with a **5%** business earnings bonus. `bizcity.ts:151-165` computes coastal positions; `bizcity.ts:2090+` draws floating plots and builds landmarks. `tycoon.ts:2198-2220` currently calls `mayorChoice` with one text-heavy option, while `renderCity` near line 889 adds a basic “For sale” tag.

**World presentation:** make each parcel visually identifiable *before purchase*: Meadow = mini sports field preview and flags; Lakeside = teal water + wheel silhouette; Hillside = pastel roof cluster. Use a desaturated miniature “architect's model” for unowned structures, 0.4–0.55 opacity or a tinted opaque material rather than sorting-heavy full transparency. Surround with an elegant 0.07-thick ivory boundary path and 4–6 tasteful wooden stakes, not a full torus fence. Sign should face the camera or principal street, not always global z. Add a light connector outline toward the island and a shadow on the gap to communicate future attachment. Keep sale plot hover subtle.

**Bought transition:** animate land moving inward over 1.1–1.5 seconds with ease-out, reveal a continuous ground connector, then raise buildings in staggered groups; only show the +5% reward after the join is visually complete. Persist purchase state first (current flow already calls `buyLand`, persists, then visits the landmark), but ensure animation can be skipped or resumed safely on reload.

**Dialog:** replace single-row `mayorChoice` presentation with a dedicated, accessible land sheet built around a small live 3D preview or a cached thumbnail. Show parcel name, destination, 3 benefits, total price, current cash, cash shortfall if any, and the exact “+5% earnings to every business” effect. Primary CTA “Buy Meadow Fields · 15,000+” uses actual computed price; disable when unaffordable and offer “Keep earning” without triggering a failed purchase. Secondary “Not now”. Do not promise a fixed price: `landPrice` is income-scaled. Use a confirm step only if economy design requires it; otherwise one clear purchase tap. Preserve `mayor.ts` character dialogue as an optional short endorsement, not the main information hierarchy. In `styles.css`, implement a max-width ~420px sheet, 16–20px padding, 14–18px radius, 44px minimum touch targets, visible focus ring, safe-area bottom padding, reduced-motion support, and high contrast. In `renderCity`, shorten map tag to “Land · [price]” with an unobstructed leader line and screen-edge clamping.

## 5. Block corners and floating island edges

**Corners:** replace concentric rounded rectangles with a consistent **corner kit**: 0.5–0.65 sidewalk fillet, small curb ramp 0.28 wide at crossings, 0.32 × 0.48 flower bed or tree pit set back 0.25 from pedestrian clear path, optional 0.12 bollard. Keep 0.55 clear walk width in the compact design. Place lamps on alternating corners, never every corner. Add occasional brick paving wedge, with rotation following road tangent; avoid dense decorative clutter near zebras.

**Edges:** generate a coastline spline or 16–32 point beveled outline with layered colors: grass lip 0.12, warm earth 0.22–0.35, rock face 1.2–1.8, darker undercut. Vary cliff geometry with deterministic low-frequency noise at amplitude 0.12–0.28, not per-frame displacement. Add 0.1–0.2 wide grass overhang, rock cracks/strata via vertex color, and sparse hanging vines. Where beaches meet water, blend sand into a 0.35–0.55 shallow shelf; foam follows coastline arc length rather than a global z stripe. For purchased parcels, rebuild a *single joined silhouette* instead of two overlapping platforms.

## 6. Top five upgrades by impact per effort

| Rank | Upgrade | Impact (1–5) | Effort (1–5) | Ratio | Acceptance criterion |
|---|---|---:|---:|---:|---|
| **1** | Unified street profiles, marking spacing and clean intersections | 5 | 3 | **1.67** | No road paint under islands/curbs; readable crossings at every node; vehicles stay within lanes |
| **2** | Correct grounding, curb heights, footprint collision checks | 5 | 3 | **1.67** | No visibly floating feet, tires, signs, fountains or shop/terrace intersections across all states |
| **3** | Water shader color pipeline and shoreline foam/depth | 4 | 3 | **1.33** | Coherent day/night water; foam tracks shore; no cyan emissive glow overpowering sun |
| **4** | Premium land preview, purchase sheet and attachment reveal | 4 | 3 | **1.33** | Parcel identity visible before purchase; price/bonus readable; joined island has no seam |
| **5** | Beveled corners, rock strata, grass macro-variation | 4 | 4 | **1.00** | Continuous corner language and distinctive floating-island silhouette at normal zoom |

**Implementation sequence:** (A) screenshot baseline and geometry assertions; (B) street node/edge mesh builder and route alignment; (C) contact/collision fixes; (D) shader cleanup; (E) expansion presentation and terrain union; (F) island-edge polish. Keep every stage separately reviewable and profile draw calls, shader compilation, GPU frame time and memory on low-end mobile.

## Art-direction guardrails and test plan

1. **Silhouette before detail:** every building, road and island must read at the standard isometric zoom; reserve tiny props for close-ups.
2. **One palette:** warm pale sidewalks, muted slate asphalt, varied spring green, turquoise-to-deep-blue water, pastel storefront accents. Avoid simultaneously saturated road, grass, water and signs.
3. **One contact language:** shared surface-height queries and deterministic prop clearance. No arbitrary per-system y offsets.
4. **One road graph:** geometry, markings, pathfinding, pedestrian crossings, cars and lamps derive from the same edge/node topology.
5. **One expansion boundary:** unowned parcel has a readable gap; owned parcel becomes a single topological landmass.

**Test matrix:** 3 land plots × unlisted/for-sale/bought × day/sunset/night/rain × top-down/isometric/low-angle; also HQ present/absent, terrace ghost/built, and first island versus full city. Capture screenshots at consistent camera transforms. Check road seams, alpha ordering, floating objects, occluded UI tags, FPS and memory. Include an accessibility pass for land sheet keyboard focus and reduced motion.

**Scope and limitations:** this document recommends changes only. No gameplay/rendering source files were edited. Static inspection establishes geometry/material relationships; screenshots and device testing are still necessary to confirm which visual risks occur in production.
