// Simulated playtests for the tower game: bot players of different skill build many towers
// with the real game rules, tapping like people do (a timing error with some spread and a
// slight lateness), and the script reports where towers end, how often drops are perfect,
// and how long towers last. Run: npx vite-node scripts/playtest.ts [towers per skill]
import { seeded } from "../src/core/rng";
import { simFor } from "../src/logic/replay";
import { RULES, TICK, type TowerSim } from "../src/logic/sim";

export interface Skill { name: string; sd: number; bias: number }
/** Timing error in seconds: its spread (sd) and how late taps land on average (bias). */
export const SKILLS: Skill[] = [
  { name: "new", sd: 0.085, bias: 0.03 },
  { name: "casual", sd: 0.06, bias: 0.02 },
  { name: "good", sd: 0.04, bias: 0.015 },
  { name: "expert", sd: 0.025, bias: 0.01 },
];

export interface TowerLog { floors: number; perfects: number; secs: number; died: number; perfectAt: boolean[]; why?: string }

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

/** Builds one tower like a player with this timing skill would. */
export function botTower(skill: Skill, seed: number, easy = false, maxFloors = 400): TowerLog {
  const sim: TowerSim = simFor({ mode: "classic", seed, week: 3, rules: RULES, easy, boosts: { rewind: false, gold: false } });
  const r = seeded(seed * 7 + 1);
  const perfectAt: boolean[] = [];
  let why = "";
  let err = skill.bias + gauss(r) * skill.sd, crossedAt = -1, lastOff = Infinity, guard = 0;
  while (guard++ < 120 * 60 * 30) {
    sim.step();
    const m = sim.mover;
    if (!m) {
      if (sim.canRewind()) { sim.rewind(); err = skill.bias + gauss(r) * skill.sd; crossedAt = -1; lastOff = Infinity; continue; }
      break;
    }
    const off = sim.offset(), toward = Math.sign(off) !== m.dir;
    // The moment it lines up: the offset changes sign.
    if (crossedAt < 0 && lastOff !== Infinity && Math.sign(off) !== Math.sign(lastOff)) crossedAt = sim.ticks;
    lastOff = off;
    // (A tiny early error can fall between two steps: then it drops right as it lines up.)
    const early = err < 0 && ((toward && Math.abs(off) / Math.max(0.1, m.v) <= -err) || crossedAt >= 0);
    const late = err >= 0 && crossedAt >= 0 && (sim.ticks - crossedAt) * TICK >= err;
    if (early || late) {
      const before = { off: sim.offset(), kind: m.kind, w: m.axis === "x" ? m.x1 - m.x0 : m.z1 - m.z0, v: m.v, early, err };
      const out = sim.drop();
      if (out?.type === "land") perfectAt[out.floor.y] = out.perfect;
      else why = JSON.stringify(before);
      err = skill.bias + gauss(r) * skill.sd; crossedAt = -1; lastOff = Infinity;
      if (sim.level >= maxFloors) break;
    }
  }
  return { floors: sim.level, perfects: sim.perfects, secs: sim.ticks * TICK, died: sim.level, perfectAt, why: why || (guard >= 120 * 60 * 30 ? "time" : "") };
}

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export function report(n = 200, easy = false): string {
  const out: string[] = [];
  for (const sk of SKILLS) {
    const logs = Array.from({ length: n }, (_, i) => botTower(sk, 1000 + i, easy));
    const f = logs.map(l => l.floors);
    // Hazard: of the towers that reached a band, how many ended in it.
    const bands = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 30], [31, 40], [41, 60], [61, 90], [91, 400]];
    const hz = bands.map(([a, b]) => {
      const reached = f.filter(x => x >= a).length, died = f.filter(x => x >= a && x <= b).length;
      return reached ? `${a}-${b}:${Math.round((died / reached) * 100)}%` : `${a}-${b}:-`;
    }).join(" ");
    const pr = bands.slice(0, 7).map(([a, b]) => {
      let p = 0, all = 0;
      for (const l of logs) for (let y = a; y <= b; y++) if (l.perfectAt[y] !== undefined) { all++; if (l.perfectAt[y]) p++; }
      return all ? `${a}-${b}:${Math.round((p / all) * 100)}%` : `${a}-${b}:-`;
    }).join(" ");
    out.push(`${sk.name.padEnd(7)} floors p10/50/90 ${pct(f, 0.1)}/${pct(f, 0.5)}/${pct(f, 0.9)}  secs p50 ${Math.round(pct(logs.map(l => l.secs), 0.5))}`);
    out.push(`        ends by band  ${hz}`);
    out.push(`        perfect rate  ${pr}`);
  }
  return out.join("\n");
}
