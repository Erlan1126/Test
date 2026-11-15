import "./styles.css";
import logoSvg from "./assets/logo.svg?raw";
import { App } from "./app";
import { initDiag } from "./diag";
import { startIcons } from "./ui/icons";

// Catch errors from the very start, so a crash while loading is reported too.
initDiag();
const app = new App(logoSvg);
// The game's own icons in place of emoji (after the page's text is in the right language).
startIcons();
// Automated tests drive the game through this handle.
if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __app: App }).__app = app;
