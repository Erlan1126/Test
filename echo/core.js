// Lumen Rush: small shared helpers every other file uses. Loaded first.
"use strict";

const $ = id => document.getElementById(id);
// The game's version, shown in Settings › About. Raise it with every release.
const GAME_VERSION = "0.12.0";
// Which screen is showing: title | run | settings.
let screen = "title";

// Days and weeks change at midnight UTC, so everyone in the world gets the same daily stage.
const dayNumber = () => Math.floor(Date.now() / 86400000);
const weekNumber = () => Math.floor((dayNumber() + 3) / 7);  // weeks start on Monday (UTC)

// A small seeded random number generator: the same seed always gives the same stage.
function seeded(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keys held down (the swing reads Space / Up to hold and Right to dash).
const keys = {};
window.addEventListener("keydown", e => { audio(); keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
// Releasing keys outside the page shouldn't leave the swing holding on by itself.
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
