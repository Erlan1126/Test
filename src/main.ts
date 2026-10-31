import "./styles.css";
import logoSvg from "./assets/logo.svg?raw";
import { App } from "./app";

const app = new App(logoSvg);
// Automated tests drive the game through this handle.
if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __app: App }).__app = app;
