// The Daily Tower's shareable result: a grid of colored squares, one per floor, that says
// how the tower went without showing it (so it spoils nothing for friends playing today).

/** How a floor landed: perfect, wide (kept most of the floor), or trimmed. */
export type Drop = "P" | "W" | "T";

const SQUARE: Record<Drop, string> = { P: "🟩", W: "🟨", T: "🟧" };
/** Squares per row, and the most rows shown (taller towers end with "+N"). */
export const ROW = 10, MAX_ROWS = 6;

/** The grid lines for a tower's floors. */
export function dropGrid(drops: Drop[]): string[] {
  const rows: string[] = [];
  for (let i = 0; i < drops.length && rows.length < MAX_ROWS; i += ROW) rows.push(drops.slice(i, i + ROW).map(d => SQUARE[d]).join(""));
  const shown = Math.min(drops.length, ROW * MAX_ROWS);
  if (drops.length > shown) rows[rows.length - 1] += ` +${drops.length - shown}`;
  return rows;
}

/** The longest run of perfect drops. */
export const bestRun = (drops: Drop[]): number => {
  let best = 0, run = 0;
  for (const d of drops) { run = d === "P" ? run + 1 : 0; best = Math.max(best, run); }
  return best;
};
