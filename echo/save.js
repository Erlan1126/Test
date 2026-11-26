// Lumen Rush: loads and saves progress in the browser.
"use strict";

// ---------- Save ----------
const SAVE_KEY = "echo-save-v1";
// The save's shape is kept from the first versions of the game (old saves and backup codes
// still load): everything saved is kept, and settings, stats and daily are merged with defaults.
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
    for (const k in s) if (!["settings", "stats", "daily"].includes(k) && s[k] != null) save[k] = s[k];
  }
} catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
// The first time the game opens, Reduce motion follows the phone's own accessibility setting.
if (save.settings.calm == null) {
  try { save.settings.calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { save.settings.calm = false; }
}
