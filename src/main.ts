import { haptic } from "./native";
import "./styles.css";
import logoSvg from "./assets/logo.svg?raw";
import { App } from "./app";
import { initDiag } from "./diag";
import { startTabNav } from "./ui/tabnav";
import { startIcons } from "./ui/icons";
import { EDITION } from "./edition";

// The tower game on its own keeps the Skyrise name; the city game is Buildaroo.
if (EDITION === "skyrise") {
  document.title = "Skyrise";
  const logo = document.querySelector(".splash-logo");
  if (logo) logo.textContent = "SKYRISE";
}

// Catch errors from the very start, so a crash while loading is reported too.
initDiag();
const app = new App(logoSvg);
// The game's own icons in place of emoji (after the page's text is in the right language).
startIcons();
startTabNav();
// Automated tests drive the game through this handle.
if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __app: App }).__app = app;

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
// A light haptic tap on every button, so the whole app feels the same under your finger.
document.addEventListener("pointerdown", e => {
  // (Only when vibration is on in Settings: the setting is read from the save each time.)
  if (!(e.target as Element).closest?.("button:not(:disabled)")) return;
  try { if (JSON.parse(localStorage.getItem("skyrise.save.v2") ?? "{}")?.settings?.vibrate === false) return; } catch { /* no save */ }
  haptic("tap");
}, { passive: true });
