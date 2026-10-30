// Builds a single self-contained copy of Echo with every script inlined, for sharing as one
// file (for example as a preview page). The game itself runs from echo.html and echo/*.js.
//   node tools/bundle-echo.js out.html
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = process.argv[2];
if (!out) {
  console.error("Usage: node tools/bundle-echo.js <output.html>");
  process.exit(1);
}
const html = fs.readFileSync(path.join(root, "echo.html"), "utf8");
const bundled = html.replace(/<script src="(echo\/[^"]+\.js)"><\/script>/g, (_, file) =>
  `<script>\n${fs.readFileSync(path.join(root, file), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);
fs.writeFileSync(out, bundled);
console.log(`Wrote ${out} (${Math.round(bundled.length / 1024)} KB)`);
