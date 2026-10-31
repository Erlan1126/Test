// Leaderboards for the people the game is shared with on claude.ai. Each player writes one
// document (`lb/<their id>`) with today's Daily score, their best tower, this week's league
// points and their streak; everyone reads all of them. Anywhere else (a plain website, a
// saved file) the capability is missing and the game simply hides the leaderboard.
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

const num = (v: unknown, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

export class Online {
  /** The leaderboard can be shown (shared storage and an identity are available). */
  ready = false;
  /** This player can post scores (false for view-only people on the share). */
  canPost = true;
  me: string | null = null;
  entries: Entry[] = [];
  /** No answer from the store yet after a while. */
  stale = false;
  onChange: () => void = () => {};
  private db: Db | null = null;
  private user: User | null = null;
  private writing: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    const rt = (window as unknown as { claude?: Runtime }).claude;
    if (!rt?.use) return;
    const [db, user] = await Promise.all([rt.use("db"), rt.use("user")]) as [Db | null, User | null];
    if (!db || !user) return;
    this.me = await user.id();
    if (!this.me) return;
    this.db = db;
    this.user = user;
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

  /** Posts this player's numbers after a tower or a nickname change. Writes go one at a time. */
  post(save: SaveData, today: number, streak: number): void {
    if (!this.ready || !this.canPost || !this.db || !this.me) return;
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

  /** Display names for the given players, as this viewer may see them. */
  async names(ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const ps = this.user ? await this.user.profiles(ids) : {};
    for (const id of ids) {
      const e = this.entries.find(x => x.id === id);
      out[id] = e?.nick || ps[id]?.name || (id === this.me ? "You" : "Builder");
    }
    return out;
  }

  /** Today's Daily ranking. */
  daily(today: number): Entry[] {
    return this.entries.filter(e => e.dailyDay === today && e.dailyScore > 0).sort((a, b) => b.dailyScore - a.dailyScore);
  }

  weekly(week: number): Entry[] {
    return this.entries.filter(e => e.week === week && e.weekPoints > 0).sort((a, b) => b.weekPoints - a.weekPoints);
  }

  allTime(): Entry[] {
    return this.entries.filter(e => e.best > 0).sort((a, b) => b.best - a.best);
  }

  /** The player just above you in today's Daily, to chase. */
  rival(today: number): { entry: Entry; gap: number; rank: number; of: number } | null {
    const list = this.daily(today), i = list.findIndex(e => e.id === this.me);
    if (!list.length || (list.length < 2 && list[0].id === this.me)) return null;
    // Not on today's board yet: point at the leader.
    if (i === -1) return { entry: list[0], gap: list[0].dailyScore + 1, rank: 0, of: list.length };
    if (i === 0) return null;
    return { entry: list[i - 1], gap: list[i - 1].dailyScore - list[i].dailyScore + 1, rank: i + 1, of: list.length };
  }
}
