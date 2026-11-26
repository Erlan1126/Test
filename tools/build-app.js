// Builds www/, the folder the phone apps (Capacitor: android/, ios/) load Lumen Rush from.
//   npm run build:app      (then: npx cap sync)
// It's the single-file game from bundle-echo.js, plus a small bridge so the web features the
// game uses work inside the apps: vibration becomes the phone's haptics (iPhones have no
// navigator.vibrate) and Share opens the phone's own share sheet (Android's web view has no
// navigator.share). The website keeps running from echo.html as before.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const www = path.join(root, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www);

const page = path.join(www, "index.html");
execFileSync(process.execPath, [path.join(__dirname, "bundle-echo.js"), page], { stdio: "inherit" });

// Runs before the game's own scripts. window.Capacitor is there from the first line in the apps.
const bridge = `<script>
(function () {
  var C = window.Capacitor, P = C && C.Plugins;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.documentElement.classList.add("app");
  if (P.Haptics) {
    navigator.vibrate = function (ms) {
      var n = Array.isArray(ms) ? ms[0] : ms;
      try { P.Haptics.impact({ style: n >= 40 ? "HEAVY" : n >= 15 ? "MEDIUM" : "LIGHT" }); } catch (e) {}
      return true;
    };
  }
  if (P.Share) {
    // Files can't cross into the share sheet from here; the game then shares the text and link.
    navigator.canShare = function (d) { return !(d && d.files); };
    navigator.share = function (d) {
      d = d || {};
      return P.Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: "Share" }).then(function () {}, function (e) {
        var err = new Error((e && e.message) || "Share cancelled"); err.name = "AbortError"; throw err;
      });
    };
  }
})();
</script>`;
let html = fs.readFileSync(page, "utf8");
const at = html.indexOf("<script");
if (at < 0) throw new Error("no <script> in the bundled page");
html = html.slice(0, at) + bridge + "\n" + html.slice(at);
fs.writeFileSync(page, html);

// The privacy page (linked from Settings → About) and the icons the page refers to.
for (const f of ["lumen-rush-privacy.html", "echo.webmanifest", "echo-icon.svg", "echo-icon-192.png", "echo-icon-512.png", "echo-apple-touch-icon.png"])
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(www, f));
// The privacy page's way back points at the website's page name.
const privacy = path.join(www, "lumen-rush-privacy.html");
if (fs.existsSync(privacy)) fs.writeFileSync(privacy, fs.readFileSync(privacy, "utf8").replace(/href="(\.\/)?echo\.html"/g, 'href="index.html"'));
// The privacy page uses the font file; the game has it inlined.
fs.mkdirSync(path.join(www, "echo", "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(root, "echo", "fonts"))) fs.copyFileSync(path.join(root, "echo", "fonts", f), path.join(www, "echo", "fonts", f));
console.log("www/ ready for npx cap sync");
