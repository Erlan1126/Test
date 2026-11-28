// Prints the pacing timeline: npx vite-node scripts/pacing-sim.ts [days=14] [dt=1]
// (ALL=1 also lists every manager hired.) The model is in scripts/pacing-model.ts.
import { fmtMin, longestGap, simulate } from "./pacing-model";

const DAY = 1440;
const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
{
  const days = Number(argv[2] ?? 14), dt = Number(argv[3] ?? 1);
  const r = simulate({ days, dt });
  console.log("\nTimeline (minute → what happened):");
  for (const e of r.events) if (e.kind !== "manager" || (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ALL) console.log(`${fmtMin(e.min).padStart(11)}  ${e.kind.padEnd(7)} ${e.text}`);
  console.log("\nCity Hall levels:", r.hall.map((m, i) => (i >= 2 && m !== undefined ? `L${i} ${fmtMin(m)}` : "")).filter(Boolean).join(" · "));
  const g1 = longestGap(r.events, 0, 180), g2 = longestGap(r.events, 180, days * DAY);
  console.log(`Longest wait for something new: ${fmtMin(g1.gap)} in the first 3 hours (from ${fmtMin(g1.at)}), ${fmtMin(g2.gap)} after (from ${fmtMin(g2.at)})`);
}
