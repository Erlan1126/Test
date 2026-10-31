import { defineConfig, type Plugin } from "vite";

/** Puts the bundled script and styles inside index.html, so the game is a single file that
 *  also runs from file:// and embeds anywhere. Icons and the manifest stay as separate files. */
function singleFile(): Plugin {
  return {
    name: "single-file",
    enforce: "post",
    generateBundle(_opts, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") return;
      let src = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === "chunk" && file.isEntry) {
          src = src.replace(new RegExp(`<script[^>]*src="[^"]*${name}"[^>]*></script>`), () =>
            `<script type="module">${file.code.replace(/<\/script/gi, "<\\/script")}</script>`);
          delete bundle[name];
        } else if (file.type === "asset" && name.endsWith(".css")) {
          src = src.replace(new RegExp(`<link[^>]*href="[^"]*${name}"[^>]*>`), () => `<style>${String(file.source)}</style>`);
          delete bundle[name];
        }
      }
      html.source = src;
    },
  };
}

export default defineConfig({
  // Relative paths so the built game works from any folder or host.
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 100000, modulePreload: false },
  plugins: [singleFile()],
});
