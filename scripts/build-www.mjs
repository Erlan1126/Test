// Copies the app into www/, the folder Capacitor bundles into the iPhone app.
// The app itself is index.html at the repo root (also served by GitHub Pages).
import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = ["index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

rmSync("www", { recursive: true, force: true });
mkdirSync("www");
for (const f of files) cpSync(f, `www/${f}`);
console.log(`Copied ${files.length} files to www/`);
