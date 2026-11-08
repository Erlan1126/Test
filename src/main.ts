import "./styles.css";
import logoSvg from "./assets/logo.svg?raw";
import { App } from "./app";
import { initDiag } from "./diag";

// Catch errors from the very start, so a crash while loading is reported too.
initDiag();
const app = new App(logoSvg);
// Automated tests drive the game through this handle.
if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __app: App }).__app = app;
