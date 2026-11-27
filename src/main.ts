import { haptic } from "./native";
import "./styles.css";
import logoSvg from "./assets/logo.svg?raw";
import { App } from "./app";
import { initDiag } from "./diag";
import { startTabNav } from "./ui/tabnav";
import { startIcons } from "./ui/icons";
import { EDITION } from "./edition";
import { toast } from "./ui/dom";
import { hallBanner } from "./ui/mayor";
import { citySeason, seasonDebug } from "./data/season";

// The tower game on its own keeps the Skyrise name; the city game is Buildaroo.
if (EDITION === "skyrise") {
  document.title = "Skyrise";
  const logo = document.querySelector(".splash-logo");
  if (logo) logo.textContent = "SKYRISE";
}

// Testing: ?debug&season=winter&weather=snow (or rain, clear, rainbow) forces Winter Lights and the weather,
// and &date=2026-12-05 fakes the day for the Advent calendar.
{
  const q = new URLSearchParams(location.search);
  if (q.has("debug")) {
    const sn = q.get("season"), w = q.get("weather");
    if (sn !== null) seasonDebug.season = (["spring", "summer", "halloween", "winter"].includes(sn) ? sn : "") as typeof seasonDebug.season;
    if (w === "snow" || w === "rain" || w === "clear") seasonDebug.weather = w;
    // (weather=rainbow: a clear sky with the rainbow that follows rain.)
    if (w === "rainbow") { seasonDebug.weather = "clear"; seasonDebug.rainbow = true; }
    // ?debug&date=2026-12-05: the calendar features (the Advent calendar) act as if it were
    // that day, at the same time of day; its season comes with it unless one is given.
    const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q.get("date") ?? "");
    if (dm) {
      const now = new Date(), at = new Date(+dm[1], +dm[2] - 1, +dm[3], now.getHours(), now.getMinutes(), now.getSeconds());
      seasonDebug.shift = at.getTime() - now.getTime();
      if (sn === null) seasonDebug.season = citySeason(at.getTime());
    }
  }
}

// Catch errors from the very start, so a crash while loading is reported too.
initDiag();
const app = new App(logoSvg);
// The game's own icons in place of emoji (after the page's text is in the right language).
startIcons();
startTabNav();
// Automated tests drive the game through this handle.
if (new URLSearchParams(location.search).has("debug")) { (window as unknown as { __app: App }).__app = app; (window as unknown as { __toast: typeof toast }).__toast = toast; (window as unknown as { __hallBanner: typeof hallBanner }).__hallBanner = hallBanner; }

// The splash fades once the island has drawn (or after a few seconds whatever happens).
{
  const splash = document.getElementById("splash");
  const t0 = performance.now();
  const done = () => {
    if (!splash || splash.classList.contains("out")) return;
    // Shown for at least a moment, so it reads as an opening, not a flicker.
    const wait = 1200 - (performance.now() - t0);
    if (wait > 0) { setTimeout(done, wait); return; }
    splash.classList.add("out");
    setTimeout(() => splash.remove(), 700);
  };
  new MutationObserver((_, obs) => { if (document.body.classList.contains("scene-ready")) { obs.disconnect(); setTimeout(done, 250); } })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (!document.body.classList.contains("webgl")) setTimeout(done, 600); // the flat graphics draw at once
  setTimeout(done, 4500);
}
let vibrateAt = 0, vibrateOn = true;
// A light haptic tap on every button, so the whole app feels the same under your finger.
document.addEventListener("pointerdown", e => {
  // (Only when vibration is on in Settings: the setting is read from the save each time.)
  if (!(e.target as Element).closest?.("button:not(:disabled)")) return;
  // (The setting is checked at most every few seconds: reading the whole save on every press
  // made taps feel slow on phones.)
  const now = Date.now();
  if (now - vibrateAt > 3000) {
    vibrateAt = now;
    try { vibrateOn = JSON.parse(localStorage.getItem("skyrise.save.v2") ?? "{}")?.settings?.vibrate !== false; } catch { vibrateOn = true; }
  }
  if (!vibrateOn) return;
  haptic("tap");
}, { passive: true });
