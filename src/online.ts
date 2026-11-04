// Leaderboards. Two kinds:
//
// - Worldwide (the apps and the website, once SERVER_URL is set): each Classic or Daily
//   tower is sent to the Skyrise server as its seed and taps. The server replays it with
//   the same rules and ranks the score it computes, so a made-up score can't get in.
// - Friends (the shared claude.ai page): each player writes one document (`lb/<id>`) with
//   today's Daily score, their best tower, this week's league points and their streak.
//
// Anywhere else the leaderboard is hidden.
import { SERVER_URL } from "./data/server";
import type { RunRecord } from "./logic/replay";
import type { SaveData } from "./logic/save";

/** Just the parts of the claude.ai page runtime this file uses. */
interface Snap { id: string; data(): Record<string, unknown> | undefined }
interface DocRef { set(data: Record<string, unknown>): Promise<void> }
interface Coll { limit(n: number): Coll; onSnapshot(next: (s: { docs: Snap[] }) => void, error?: (e: { code: string }) => void): () => void }
interface Db { doc(path: string): DocRef; collection(path: string): Coll }
interface Profile { name: string; avatarUrl: string; isMe: boolean }
interface User {
  id(): Promise<string | null>;
  can(name: string): Promise<boolean | null>;
  profiles(ids: string[]): Promise<Record<string, Profile>>;
}
type Runtime = { use(name: string): Promise<unknown> };

/** A friends-board entry from the claude.ai page. */
export interface Entry {
  id: string;
  nick: string;
  dailyDay: number;
  dailyScore: number;
  best: number;
  bestMeters: number;
  week: number;
  weekPoints: number;
  streak: number;
}

export type Tab = "daily" | "week" | "best";

/** One line on a leaderboard, whichever kind. */
export interface Row {
  id: string;
  rank: number;
  name: string;
  level?: number;
  value: number;
  unit: "people" | "pts";
  streak?: number;
  me: boolean;
}

export interface Board { rows: Row[]; me: Row | null; total: number }

const num = (v: unknown, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const API = SERVER_URL.replace(/\/$/, "");

export class Online {
  /** The leaderboard can be shown. */
  ready = false;
  /** "global" for the worldwide server, "friends" for the claude.ai page. */
  kind: "global" | "friends" | null = null;
  /** This player can post scores (false for view-only people on the share). */
  canPost = true;
  me: string | null = null;
  /** No answer from the server or store yet after a while. */
  stale = false;
  onChange: () => void = () => {};
  /** The ranks from the last tower sent to the worldwide server. */
  lastRanks: { daily?: number; week?: number; all?: number } | null = null;
  private entries: Entry[] = [];
  private db: Db | null = null;
  private user: User | null = null;
  private writing: Promise<void> = Promise.resolve();
  private cache = new Map<string, { at: number; board: Board }>();

  async init(playerId: string): Promise<void> {
    const rt = (window as unknown as { claude?: Runtime }).claude;
    if (rt?.use) { await this.initFriends(rt); return; }
    if (!API || !playerId) return;
    this.kind = "global";
    this.me = playerId;
    this.ready = true;
    this.onChange();
  }

  private async initFriends(rt: Runtime): Promise<void> {
    const [db, user] = await Promise.all([rt.use("db"), rt.use("user")]) as [Db | null, User | null];
    if (!db || !user) return;
    this.me = await user.id();
    if (!this.me) return;
    this.db = db;
    this.user = user;
    this.kind = "friends";
    this.canPost = (await user.can("data.write")) !== false;
    this.ready = true;
    // One subscription for the whole page; views are derived from it.
    const timer = setTimeout(() => { this.stale = true; this.onChange(); }, 10000);
    db.collection("lb").limit(500).onSnapshot(snap => {
      clearTimeout(timer);
      this.stale = false;
      this.entries = snap.docs.map(d => this.parse(d)).filter((e): e is Entry => !!e);
      this.onChange();
    }, () => {
      clearTimeout(timer);
      this.ready = false;
      this.onChange();
    });
    this.onChange();
  }

  /** Shared data is other people's input: keep only well-formed fields. */
  private parse(d: Snap): Entry | null {
    const x = d.data();
    if (!x) return null;
    return {
      id: d.id,
      nick: typeof x.nick === "string" ? x.nick.slice(0, 16) : "",
      dailyDay: num(x.dailyDay), dailyScore: num(x.dailyScore), best: num(x.best), bestMeters: num(x.bestMeters),
      week: typeof x.week === "number" && Number.isFinite(x.week) ? Math.floor(x.week) : -1, weekPoints: num(x.weekPoints), streak: num(x.streak, 10000),
    };
  }

  // ---------- Posting ----------

  /** Friends board: posts this player's numbers after a tower or a name change. */
  post(save: SaveData, today: number, streak: number): void {
    if (this.kind !== "friends" || !this.canPost || !this.db || !this.me) return;
    const body = {
      nick: save.nickname,
      dailyDay: save.daily.day === today ? today : 0,
      dailyScore: save.daily.day === today ? save.daily.best : 0,
      best: save.best,
      bestMeters: save.bestMeters,
      week: save.league.week,
      weekPoints: save.league.points,
      streak,
    };
    const ref = this.db.doc(`lb/${this.me}`);
    this.writing = this.writing.then(() => ref.set(body)).catch((e: { code?: string }) => {
      // View-only people can read but not post: show the board without their row.
      if (e?.code === "invalid_argument") { this.canPost = false; this.onChange(); }
    });
  }

  /** Worldwide board: sends a finished Classic or Daily tower. `persist` saves a new token. */
  async submit(save: SaveData, rec: RunRecord, persist: () => void): Promise<void> {
    if (this.kind !== "global" || (rec.mode !== "classic" && rec.mode !== "daily") || !rec.log.length) return;
    try {
      if (!save.onlineToken) {
        const res = await fetch(`${API}/players`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ player: save.playerId }) });
        if (!res.ok) return;
        save.onlineToken = String((await res.json() as { token?: string }).token ?? "");
        persist();
      }
      const res = await fetch(`${API}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ player: save.playerId, token: save.onlineToken, name: save.nickname, level: save.profile.level, record: rec }),
      });
      if (!res.ok) return;
      this.lastRanks = (await res.json() as { ranks?: Online["lastRanks"] }).ranks ?? null;
      this.stale = false;
      this.cache.clear();
      // Keep today's board fresh for the rival line on the menu.
      void this.board("daily", rec.day, rec.week).then(() => this.onChange());
      this.onChange();
    } catch {
      this.stale = true;
    }
  }

  // ---------- Reading ----------

  /** A leaderboard to show. Worldwide boards are fetched (and kept for 30 seconds). */
  async board(tab: Tab, today: number, week: number): Promise<Board> {
    if (this.kind === "friends") return this.friendsBoard(tab, today, week);
    if (this.kind !== "global") return { rows: [], me: null, total: 0 };
    const board = tab === "best" ? "all" : tab, period = tab === "daily" ? today : tab === "week" ? week : 0;
    const key = `${board}:${period}`, hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.board;
    try {
      const res = await fetch(`${API}/board?board=${board}&period=${period}&player=${encodeURIComponent(this.me ?? "")}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json() as { top?: unknown[]; me?: { rank?: number; score?: number } | null; total?: number };
      const rows: Row[] = (Array.isArray(body.top) ? body.top : []).map(x => {
        const r = x as Record<string, unknown>;
        return {
          id: String(r.id ?? ""), rank: num(r.rank), name: String(r.name ?? "Builder").slice(0, 16),
          level: num(r.level, 999), value: num(r.score), unit: "people" as const, me: r.id === this.me,
        };
      });
      const meRank = body.me?.rank;
      const me: Row | null = meRank
        ? rows.find(r => r.me) ?? { id: this.me ?? "", rank: num(meRank), name: "You", value: num(body.me?.score), unit: "people", me: true }
        : null;
      const out = { rows, me, total: num(body.total) };
      this.stale = false;
      this.cache.set(key, { at: Date.now(), board: out });
      return out;
    } catch {
      this.stale = true;
      return hit?.board ?? { rows: [], me: null, total: 0 };
    }
  }

  private async friendsBoard(tab: Tab, today: number, week: number): Promise<Board> {
    const list = tab === "daily" ? this.entries.filter(e => e.dailyDay === today && e.dailyScore > 0).sort((a, b) => b.dailyScore - a.dailyScore)
      : tab === "week" ? this.entries.filter(e => e.week === week && e.weekPoints > 0).sort((a, b) => b.weekPoints - a.weekPoints)
      : this.entries.filter(e => e.best > 0).sort((a, b) => b.best - a.best);
    const ids = list.slice(0, 100).map(e => e.id);
    const ps = this.user ? await this.user.profiles(ids) : {};
    const rows: Row[] = list.slice(0, 100).map((e, i) => ({
      id: e.id, rank: i + 1,
      name: e.nick || ps[e.id]?.name || (e.id === this.me ? "You" : "Builder"),
      value: tab === "daily" ? e.dailyScore : tab === "week" ? e.weekPoints : e.best,
      unit: tab === "week" ? "pts" : "people", streak: e.streak, me: e.id === this.me,
    }));
    return { rows, me: rows.find(r => r.me) ?? null, total: list.length };
  }

  /** The player just above you in today's Daily, to chase (from what's already loaded). */
  rival(today: number, week: number): { id: string; name: string; gap: number; rank: number; of: number } | null {
    const board = this.kind === "friends" ? null : this.cache.get(`daily:${today}`)?.board;
    let rows: Row[], me: Row | null, total: number;
    if (this.kind === "friends") {
      const list = this.entries.filter(e => e.dailyDay === today && e.dailyScore > 0).sort((a, b) => b.dailyScore - a.dailyScore);
      rows = list.map((e, i) => ({ id: e.id, rank: i + 1, name: e.nick || "Builder", value: e.dailyScore, unit: "people", me: e.id === this.me }));
      me = rows.find(r => r.me) ?? null;
      total = rows.length;
    } else {
      if (!board) { void this.board("daily", today, week).then(b => { if (b.rows.length) this.onChange(); }); return null; }
      ({ rows, me, total } = board);
    }
    if (!rows.length || (rows.length === 1 && rows[0].me)) return null;
    if (!me) return { id: rows[0].id, name: rows[0].name, gap: rows[0].value + 1, rank: 0, of: total };
    if (me.rank <= 1) return null;
    const above = rows[Math.min(me.rank, rows.length) - 2];
    return above ? { id: above.id, name: above.name, gap: above.value - me.value + 1, rank: me.rank, of: total } : null;
  }

  /** Your place on today's Daily, if known. */
  dailyPlace(today: number, myBest: number): { rank: number; of: number } | null {
    if (this.kind === "global") {
      const b = this.cache.get(`daily:${today}`)?.board;
      return this.lastRanks?.daily ? { rank: this.lastRanks.daily, of: Math.max(b?.total ?? 0, this.lastRanks.daily) } : null;
    }
    if (this.kind !== "friends") return null;
    const others = this.entries.filter(e => e.id !== this.me && e.dailyDay === today && e.dailyScore > 0);
    return others.length ? { rank: others.filter(e => e.dailyScore > myBest).length + 1, of: others.length + 1 } : null;
  }

  /** Display names for friends-board players (used for the rival line). */
  async names(ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const ps = this.user ? await this.user.profiles(ids) : {};
    for (const id of ids) out[id] = this.entries.find(x => x.id === id)?.nick || ps[id]?.name || "Builder";
    return out;
  }
}
