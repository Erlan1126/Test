// Game Center on iPhone: the player is signed in at launch (Apple shows its own banner),
// each tower's people and height go to two leaderboards, and every trophy is reported as
// a Game Center achievement. The native side is ios/App/App/GameCenterPlugin.swift.
// Everywhere else (Android, the website) these do nothing.
//
// The ids must match what's set up in App Store Connect (see launch/GAMECENTER.md).
import { registerPlugin } from "@capacitor/core";
import { platform } from "./native";
import type { SaveData } from "./logic/save";

interface GameCenterPlugin {
  signIn(): Promise<{ signedIn: boolean }>;
  submitScore(o: { leaderboard: string; score: number }): Promise<{ ok: boolean }>;
  unlockAchievements(o: { ids: string[] }): Promise<{ ok: boolean }>;
  showLeaderboard(o: { leaderboard?: string }): Promise<{ ok: boolean }>;
}

export const GC_BOARDS = { people: "skyrise.best_people", height: "skyrise.tallest_tower" } as const;
/** Achievement id for a trophy id. */
export const gcAchievement = (trophy: string): string => `skyrise.trophy.${trophy}`;

const GC = platform() === "ios" ? registerPlugin<GameCenterPlugin>("GameCenter") : null;
const SENT_KEY = "skyrise.gcSent";
let signedIn = false;

export const gameCenterAvailable = (): boolean => !!GC;

export async function gameCenterSignIn(): Promise<boolean> {
  if (!GC) return false;
  try { signedIn = (await GC.signIn()).signedIn; } catch { signedIn = false; }
  return signedIn;
}

/** After a tower: post its numbers and any trophies Game Center hasn't heard of yet. */
export async function gameCenterSync(save: SaveData, score: number, meters: number): Promise<void> {
  if (!GC || !signedIn) return;
  try {
    if (score > 0) await GC.submitScore({ leaderboard: GC_BOARDS.people, score: Math.round(score) });
    if (meters > 0) await GC.submitScore({ leaderboard: GC_BOARDS.height, score: Math.round(meters) });
    let sent: string[] = [];
    try { sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]"); } catch { /* none yet */ }
    const fresh = save.profile.trophies.filter(id => !sent.includes(id));
    if (fresh.length && (await GC.unlockAchievements({ ids: fresh.map(gcAchievement) })).ok) {
      try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...fresh])); } catch { /* private mode */ }
    }
  } catch { /* Game Center unavailable: the game doesn't depend on it */ }
}

/** The city game: its trophies Game Center hasn't heard of yet. */
export async function gameCenterCity(ids: string[]): Promise<void> {
  if (!GC || !signedIn || !ids.length) return;
  try {
    let sent: string[] = [];
    try { sent = JSON.parse(localStorage.getItem(SENT_KEY + ".city") ?? "[]"); } catch { /* none yet */ }
    const fresh = ids.filter(id => !sent.includes(id));
    if (fresh.length && (await GC.unlockAchievements({ ids: fresh.map(id => `buildaroo.${id}`) })).ok) {
      try { localStorage.setItem(SENT_KEY + ".city", JSON.stringify([...sent, ...fresh])); } catch { /* private mode */ }
    }
  } catch { /* Game Center unavailable */ }
}

export async function showGameCenter(): Promise<boolean> {
  if (!GC) return false;
  if (!signedIn && !(await gameCenterSignIn())) return false;
  try { return (await GC.showLeaderboard({})).ok; } catch { return false; }
}
