/** Which bubbles over the town get shown: only what the player can act on, a handful at a
 *  time, the most urgent first and the ones nearest the middle of the screen next, and never
 *  two on top of each other. Pure, so the town can run it every frame and the tests can too. */

/** What a bubble is about. Each kind has its own look (see styles.css, `[data-k]`). */
export type TagKind =
  | "event"   // a timed visitor: golden customer, VIP, critic, power cut
  | "grow"    // a business ready for its HQ, the City Hall ready to level up, a building to upgrade
  | "collect" // money or a gift waiting: the bottle, a finished request, a resident's tip
  | "ask"     // a neighbour's request
  | "goal"    // what the Next step points at
  | "sale"    // land or a lot for sale the player can buy now
  | "run"     // a business with no manager yet: tap it to sell
  | "info";   // the plain level bubbles and timers: only when looking closely

/** How urgent each kind is (bigger first). */
export const TAG_RANK: Record<TagKind, number> = { event: 7, grow: 6, collect: 5, ask: 4, goal: 4, sale: 3, run: 2, info: 0 };

/** At most this many bubbles at once. */
export const TAG_CAP = 5;
/** Looking closely (pinched in): the level bubbles come back, a few more at a time. */
export const TAG_CAP_CLOSE = 9;
/** The camera zoom from which the town counts as looked at closely. */
export const CLOSE_ZOOM = 1.75;

export interface TagIn {
  kind: TagKind;
  /** Anchor: the middle of the bubble's bottom edge, in screen pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tie-break within a kind (bigger first). */
  urgent?: number;
  /** The selected building's bubble, or a caption the story needs: always shown. */
  pin?: boolean;
  /** Shown last frame: it holds its place a little, so bubbles don't flicker as the camera moves. */
  was?: boolean;
  /** Off screen or under the bars: never shown, never counted. */
  out?: boolean;
}

export interface TagOpts {
  /** The middle of the screen. */
  cx: number;
  cy: number;
  /** Looking closely: the "info" bubbles may show too. */
  close: boolean;
  /** A building's card is open: only pinned bubbles stay. */
  focus?: boolean;
  cap?: number;
  /** Extra room kept between two bubbles, in pixels (negative: they may just touch). */
  gap?: number;
  /** A bubble lifted out of another's way may not go above this line (the money bar). */
  top?: number;
}

export interface TagPick {
  /** Shown or not, at the same index as the input. */
  show: boolean[];
  /** Where each bubble's bottom edge goes: its own spot, or lifted clear of a more urgent one. */
  y: number[];
}

/** Whether a bubble of this kind may show at all. */
export function tagAllowed(kind: TagKind, close: boolean): boolean {
  return kind !== "info" || close;
}

const overlaps = (a: TagIn, b: TagIn, gap: number) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w + gap * 2 && a.y - a.h - gap < b.y && b.y - b.h - gap < a.y;

/** Which of the bubbles to show. Pinned ones always; the others ranked by kind, then
 *  urgency, then distance to the screen's middle, up to the cap. One that would cover a
 *  bubble already chosen is lifted just above it (twice at most), or else dropped. */
export function pickTags(items: readonly TagIn[], o: TagOpts): TagPick {
  const show = items.map(() => false), ys = items.map(it => it.y);
  const cap = o.cap ?? (o.close ? TAG_CAP_CLOSE : TAG_CAP), gap = o.gap ?? -2, top = o.top ?? -Infinity;
  const dist = (it: TagIn) => Math.hypot(it.x - o.cx, it.y - it.h / 2 - o.cy) - (it.was ? 60 : 0);
  const order = items.map((_, i) => i).filter(i => {
    const it = items[i];
    if (it.pin) return true;
    if (it.out || o.focus) return false;
    return tagAllowed(it.kind, o.close);
  });
  const key = (i: number) => {
    const it = items[i];
    return { p: it.pin ? 1 : 0, r: TAG_RANK[it.kind], u: it.urgent ?? 0, d: dist(it) };
  };
  const keys = new Map(order.map(i => [i, key(i)]));
  order.sort((a, b) => {
    const ka = keys.get(a)!, kb = keys.get(b)!;
    return kb.p - ka.p || kb.r - ka.r || kb.u - ka.u || ka.d - kb.d;
  });
  const chosen: TagIn[] = [];
  let n = 0;
  for (const i of order) {
    let it = items[i];
    if (!it.pin) {
      if (n >= cap) break;
      let hit = chosen.find(c => overlaps(c, it, gap));
      for (let tries = 0; hit && tries < 2; tries++) {
        it = { ...it, y: hit.y - hit.h - gap };
        if (it.y - it.h < top) break;
        hit = chosen.find(c => overlaps(c, it, gap));
      }
      if (hit) continue;
    }
    show[i] = true;
    ys[i] = it.y;
    chosen.push(it);
    if (!it.pin) n++;
  }
  return { show, y: ys };
}
