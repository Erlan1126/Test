// "Beat my tower": sharing a tower makes a challenge on the server (its numbers and pace),
// and the link opens a page that launches the game. Whoever opens it races the tower as a
// ghost, and the sharer is told when friends try it and whether they beat it.
import { SERVER_URL } from "./data/server";
import { cleanPace } from "./logic/ghost";

const base = () => SERVER_URL.replace(/\/$/, "");

export interface Challenge { id: string; name: string; score: number; meters: number; floors: number; pace: number[] }
export interface Try { id: string; at: number; name: string; score: number; beat: boolean }

/** Makes a challenge from a finished tower. Returns its link, or "" if offline. */
export async function createChallenge(t: { name: string; score: number; meters: number; floors: number; pace: number[] }): Promise<{ id: string; url: string } | null> {
  if (!SERVER_URL) return null;
  try {
    const res = await fetch(`${base()}/challenge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) });
    if (!res.ok) return null;
    const { id } = await res.json() as { id?: string };
    return id ? { id, url: `${base()}/c/${id}` } : null;
  } catch { return null; }
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  if (!SERVER_URL || !/^[A-Za-z0-9]{4,16}$/.test(id)) return null;
  try {
    const res = await fetch(`${base()}/challenge?id=${id}`);
    if (!res.ok) return null;
    const c = await res.json() as Partial<Challenge>;
    if (typeof c.score !== "number") return null;
    return { id, name: String(c.name ?? "").slice(0, 24), score: c.score, meters: Number(c.meters) || 0, floors: Number(c.floors) || 0, pace: cleanPace(c.pace) };
  } catch { return null; }
}

/** Records a friend's try at a challenge. */
export async function postTry(id: string, name: string, score: number): Promise<void> {
  if (!SERVER_URL) return;
  try { await fetch(`${base()}/challenge/try`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name, score }) }); } catch { /* offline */ }
}

/** New tries at this player's own challenges since `since` (ms). */
export async function fetchTries(ids: string[], since: number): Promise<Try[]> {
  if (!SERVER_URL || !ids.length) return [];
  try {
    const res = await fetch(`${base()}/challenge/tries?ids=${ids.join(",")}&since=${since}`);
    if (!res.ok) return [];
    const { tries } = await res.json() as { tries?: Try[] };
    return Array.isArray(tries) ? tries : [];
  } catch { return []; }
}

/** The challenge id in a link: skyrise://c/ID, https://…/c/ID or ?vs=ID. */
export function challengeIdFrom(link: string): string | null {
  const m = /(?:\/c\/|[?&]vs=)([A-Za-z0-9]{4,16})/.exec(link);
  return m ? m[1] : null;
}
