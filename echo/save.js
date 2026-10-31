// Echo: loads and saves progress in the browser.
"use strict";

// ---------- Save ----------
const SAVE_KEY = "echo-save-v1";
// Everything kept as-is when loading or restoring (settings, stats and daily are merged).
const SAVE_KEYS = ["stars", "best", "muted", "skin", "skinsSeen", "looksViewed", "ach", "story", "cards", "found", "family", "hat",
  "weekly", "glow", "home", "quests", "variants", "vs", "installAsked", "lookSeen", "ended", "endingDue"];
let save = {
  stars: [], best: [], muted: false, skin: 0, skinsSeen: 1,
  settings: { music: 0.6, sfx: 0.9, vibrate: true, stick: 1, contrast: false },
  stats: { lights: 0, moths: 0, songs: 0, clean: 0, quiet: 0, gloom: 0 },
  daily: { last: "", streak: 0, best: 0, stars: {} },
  ach: {},
};
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && Array.isArray(s.stars)) {
    for (const k of ["settings", "stats", "daily"]) save[k] = Object.assign(save[k], s[k] || {});
    for (const k of SAVE_KEYS) if (s[k] != null) save[k] = s[k];
  }
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
STICK_R = STICK_SIZES[save.settings.stick] || 46;
const unlocked = i => i < 0 || i === 0 || save.settings.unlockAll || (save.stars[i - 1] || 0) > 0;
const totalStars = () => save.stars.reduce((a, b) => a + (b || 0), 0);
