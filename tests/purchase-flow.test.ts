import { describe, expect, it } from "vitest";
import { approvalHandler, creditDurably, type ApprovedTx } from "../src/logic/purchase-flow";
import { defaultSave, loadSave, writeSaveChecked, type SaveData } from "../src/logic/save";
import { CRYSTAL_PACKS } from "../src/data/premium";

const PACK = CRYSTAL_PACKS[0];

/** A phone's local storage that can be told to fail. */
function storage() {
  const data = new Map<string, string>();
  return {
    failing: false,
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem(k: string, v: string) { if (this.failing) throw new Error("QuotaExceededError"); data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

/** A store transaction that counts how often it was confirmed. */
function tx(id: string, product = PACK.id) {
  const t = { id, products: [product], finished: 0, async finish() { t.finished++; } };
  return t as ApprovedTx & { finished: number };
}

/** The game: a save in memory, saved to `disk` (and a native copy that may fail or lag). */
function game(disk: ReturnType<typeof storage>, opts: { native?: () => Promise<boolean> } = {}) {
  const g = {
    save: loadSave(disk) as SaveData,
    credits: 0,
    handler: null as unknown as (t: ApprovedTx) => Promise<boolean>,
  };
  const persist = async () => writeSaveChecked(disk, g.save) && (opts.native ? await opts.native() : true);
  g.handler = approvalHandler({
    isPack: id => CRYSTAL_PACKS.some(p => p.id === id),
    credit: async (pack, id) => {
      const r = await creditDurably(g.save, pack, id, persist);
      if (r.added) g.credits++;
      return r.durable;
    },
  }, "ios-appstore");
  return g;
}

describe("store purchases are credited exactly once and confirmed only when saved", () => {
  it("a normal purchase: credited, saved with its transaction id, then confirmed", async () => {
    const disk = storage(), g = game(disk), t = tx("1001");
    expect(await g.handler(t)).toBe(true);
    expect(t.finished).toBe(1);
    const onDisk = loadSave(disk);
    expect(onDisk.crystals).toBe(PACK.crystals * 2); // first purchase of a pack pays double
    expect(onDisk.crystalTx).toContain("ios-appstore:1001");
  });

  it("storage failure: not confirmed; a retry once storage works credits nothing extra and confirms", async () => {
    const disk = storage(), g = game(disk), t = tx("1002");
    disk.failing = true;
    expect(await g.handler(t)).toBe(false);
    expect(t.finished).toBe(0); // the store will offer it again
    expect(g.save.crystals).toBe(PACK.crystals * 2); // the player still sees the crystals now
    disk.failing = false;
    expect(await g.handler(t)).toBe(true); // the store's redelivery
    expect(t.finished).toBe(1);
    expect(g.credits).toBe(1);
    expect(loadSave(disk).crystals).toBe(PACK.crystals * 2);
  });

  it("duplicate callbacks, overlapping or repeated, credit once and confirm once", async () => {
    let release!: (v: boolean) => void;
    const disk = storage(), g = game(disk, { native: () => new Promise<boolean>(r => { release = r; }) }), t = tx("1003");
    const a = g.handler(t), b = g.handler(t); // the plugin fires twice while the backup is pending
    release(true);
    await Promise.all([a, b]);
    await g.handler(t); // and once more later
    expect(t.finished).toBe(1);
    expect(g.credits).toBe(1);
    expect(loadSave(disk).crystals).toBe(PACK.crystals * 2);
  });

  it("closing the app right after approval (native backup still pending): credited once on next launch", async () => {
    const disk = storage();
    const first = game(disk, { native: () => new Promise<boolean>(() => { /* the app is killed */ }) });
    const t = tx("1004");
    void first.handler(t);
    await Promise.resolve();
    expect(t.finished).toBe(0); // never confirmed before the backup finished
    // Next launch: the store hands the same purchase over again.
    const second = game(disk);
    expect(await second.handler(t)).toBe(true);
    expect(t.finished).toBe(1);
    const onDisk = loadSave(disk);
    expect(onDisk.crystals).toBe(PACK.crystals * 2); // exactly once in total
    expect(onDisk.crystalTx.filter(x => x === "ios-appstore:1004")).toHaveLength(1);
  });

  it("closing before anything was saved: the next launch credits it once", async () => {
    const disk = storage();
    disk.failing = true;
    const first = game(disk);
    const t = tx("1005");
    await first.handler(t);
    expect(t.finished).toBe(0);
    disk.failing = false;
    const second = game(disk); // the save on disk never had it
    expect(await second.handler(t)).toBe(true);
    expect(loadSave(disk).crystals).toBe(PACK.crystals * 2);
    expect(second.credits).toBe(1);
  });

  it("an unknown product is never credited or confirmed", async () => {
    const disk = storage(), g = game(disk), t = tx("1006", "not_a_pack");
    await g.handler(t);
    expect(g.save.crystals).toBe(0);
    expect(t.finished).toBe(1); // nothing to credit for this game: nothing to hold back
  });

  it("a save from before keeps its old transaction ids counted", () => {
    const s = defaultSave();
    s.crystalTx.push("ios-appstore:999");
    return creditDurably(s, PACK.id, "ios-appstore:999", async () => true).then(r => {
      expect(r.added).toBe(0);
      expect(r.durable).toBe(true);
      expect(s.crystals).toBe(0);
    });
  });
});
