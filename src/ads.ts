// Optional rewarded ads: the player chooses to watch a short ad for a reward (doubling a
// tower's stars). Nothing is ever shown without a tap, and there are no other ads.
//
// The ad network itself (Google AdMob) plugs in here once its account exists: a provider
// that can say whether an ad is loaded and show it. Until then `adsReady()` is false and
// the game hides every ad button, so this costs nothing.

export interface AdProvider {
  /** An ad is loaded and can be shown right away. */
  ready(): boolean;
  /** Shows a rewarded ad; resolves true only if it was watched to the end. */
  show(): Promise<boolean>;
}

/** At most this many rewarded ads a day, so it never turns into a grind. */
export const ADS_PER_DAY = 5;
const KEY = "skyrise.ads";

let provider: AdProvider | null = null;
export const setAdProvider = (p: AdProvider | null): void => { provider = p; };

const today = () => Math.floor(Date.now() / 864e5);
function watched(): { day: number; n: number } {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (v && v.day === today()) return { day: v.day, n: Number(v.n) || 0 }; } catch { /* none */ }
  return { day: today(), n: 0 };
}

/** Whether a rewarded ad can be offered now. */
export const adsReady = (): boolean => !!provider?.ready() && watched().n < ADS_PER_DAY;

/** Shows a rewarded ad. True when the player earned the reward. */
export async function showRewarded(): Promise<boolean> {
  if (!adsReady()) return false;
  let ok = false;
  try { ok = await provider!.show(); } catch { ok = false; }
  if (ok) { const w = watched(); try { localStorage.setItem(KEY, JSON.stringify({ day: w.day, n: w.n + 1 })); } catch { /* private mode */ } }
  return ok;
}
