import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../server/worker.js";
import { seeded } from "../src/core/rng";
import { RunRecorder, simFor, type RunRecord } from "../src/logic/replay";
import { dailySeed, dayNumber } from "../src/logic/rules";
import { weekIndex } from "../src/data/events";

/** A tiny stand-in for Cloudflare D1 on top of Node's built-in SQLite. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8"));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => (db.prepare(sql).get(...(args as never[])) as Record<string, unknown>) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } }),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: ReturnType<typeof stmt>[]) => { for (const s of list) await s.run(); return []; },
  };
}

let env: { DB: ReturnType<typeof fakeD1> };
beforeEach(() => { env = { DB: fakeD1() }; });

const call = async (path: string, body?: unknown) => {
  const res = await worker.fetch(new Request(`https://api.example${path}`, body === undefined ? undefined : {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), env as never);
  return { status: res.status, body: await res.json() as Record<string, any> };
};

const P1 = "11111111-2fa1-11d2-883f-0016d3cca427", P2 = "22222222-2fa1-11d2-883f-0016d3cca427";

/** Builds a real tower like a player would and returns its record. */
function play(mode: "classic" | "daily", salt: number, skill = 0.85): { rec: RunRecord; score: number } {
  const day = dayNumber();
  const rec = new RunRecorder({ mode, seed: mode === "daily" ? dailySeed(day) : 4242 + salt, day, week: weekIndex(), boosts: { rewind: false, gold: false } });
  const sim = simFor(rec.rec), r = seeded(salt);
  for (let guard = 0; guard < 300_000 && sim.mover; guard++) {
    sim.step();
    if (Math.abs(sim.offset()) < 0.05 + (1 - skill) && r() < 0.1) { rec.drop(sim.ticks); sim.drop(); }
  }
  return { rec: rec.rec, score: sim.score };
}

async function register(id: string) {
  const r = await call("/players", { player: id });
  expect(r.status).toBe(200);
  return r.body.token as string;
}

describe("online rankings", () => {
  it("registers each player id once", async () => {
    await register(P1);
    expect((await call("/players", { player: P1 })).status).toBe(409);
    expect((await call("/players", { player: "x" })).status).toBe(400);
  });

  it("ranks a replayed tower and refuses forged ones", async () => {
    const token = await register(P1);
    const { rec, score } = play("daily", 1);
    const ok = await call("/runs", { player: P1, token, name: "Erlan", level: 7, record: rec });
    expect(ok.status).toBe(200);
    expect(ok.body.score).toBe(score);
    expect(ok.body.ranks).toEqual({ daily: 1, week: 1, all: 1 });

    // Wrong token, made-up taps, an old Daily seed: all refused.
    expect((await call("/runs", { player: P1, token: "nope", record: rec })).status).toBe(403);
  });

  it("refuses bad records and posting too fast", async () => {
    const token = await register(P1);
    const { rec } = play("classic", 2);
    expect((await call("/runs", { player: P1, token, record: { ...rec, log: [90, 10] } })).status).toBe(422);
    expect((await call("/runs", { player: P1, token, record: { ...rec, mode: "daily", seed: 1 } })).status).toBe(400);
    expect((await call("/runs", { player: P1, token, record: { ...rec, week: rec.week - 5 } })).status).toBe(400);
    expect((await call("/runs", { player: P1, token, record: { ...rec, mode: "zen" } })).status).toBe(400);
    expect((await call("/runs", { player: P1, token, record: rec })).status).toBe(200);
    expect((await call("/runs", { player: P1, token, record: rec })).status).toBe(429);
  });

  it("keeps each player's best and orders the board", async () => {
    const t1 = await register(P1), t2 = await register(P2);
    const a = play("classic", 3, 0.95), b = play("classic", 4, 0.5);
    await call("/runs", { player: P1, token: t1, name: "Ace", level: 20, record: a.rec });
    await call("/runs", { player: P2, token: t2, name: "", level: 2, record: b.rec });
    const board = await worker.fetch(new Request(`https://api.example/board?board=all&period=0&player=${P2}`), env as never);
    const { top, me, total } = await board.json() as any;
    expect(total).toBe(2);
    const sorted = [a.score, b.score].sort((x, y) => y - x);
    expect(top.map((r: any) => r.score)).toEqual(sorted);
    expect(top.find((r: any) => r.id === P2).name).toMatch(/^Builder /); // blank names get a default
    expect(me.rank).toBe(a.score > b.score ? 2 : 1);
  });

  it("cleans names", async () => {
    const t = await register(P1);
    await call("/runs", { player: P1, token: t, name: "<b>Sky King!!</b> 12345678", level: 1, record: play("classic", 5).rec });
    const r = await call("/board?board=all&period=0");
    expect(r.body.top[0].name).toBe("bSky Kingb 12345");
  });
});
