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
            // With everything in one file there's nothing to preload; Vite leaves this
            // placeholder behind for code that loads later, which throws on phones.
            `<script type="module">${file.code.replace(/__VITE_PRELOAD__/g, "void 0").replace(/<\/script/gi, "<\\/script")}</script>`);
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

/** The Skyrise build keeps Skyrise's own pictures (public/skyrise/): its icons, manifest and
 *  link preview. The default build is Buildaroo, with the kangaroo. */
function skyrisePictures(): Plugin {
  let skyrise = false;
  return {
    name: "skyrise-pictures",
    configResolved(c) { skyrise = c.env.VITE_EDITION === "skyrise" || c.mode === "skyrise"; },
    transformIndexHtml(html) {
      if (!skyrise) return html;
      return html
        .replace(/(href|src|content)="(icon\.svg|icon-192\.png|icon-512\.png|apple-touch-icon\.png|manifest\.webmanifest|og\.jpg)"/g, '$1="skyrise/$2"')
        .replace(/content="Buildaroo: build your own city"/, 'content="Skyrise: build the tallest tower"')
        .replace(/(apple-mobile-web-app-title|og:site_name)" content="Buildaroo"/g, '$1" content="Skyrise"')
        .replace(/<title>[^<]*<\/title>/, "<title>Skyrise</title>");
    },
  };
}

export default defineConfig({
  // Relative paths so the built game works from any folder or host.
  base: "./",
  // One script: the app plugins' small web fallbacks are bundled in rather than split out.
  build: { target: "es2020", assetsInlineLimit: 100000, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } },
  plugins: [skyrisePictures(), singleFile()],
});
