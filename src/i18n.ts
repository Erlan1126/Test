// Translations. English text is the key, so English needs no dictionary and any string
// without a translation falls back to English. `{name}` placeholders are filled from `vars`.
import { ES } from "./i18n/es";

export type Lang = "en" | "es";
export type LangSetting = "auto" | Lang;

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, es: ES };

// English until the app picks a language, so the rules and tests always start the same.
let lang: Lang = "en";

export const getLang = (): Lang => lang;

/** The device's language, as one this game speaks. */
export function deviceLang(list: readonly string[] = browserLangs()): Lang {
  for (const l of list) {
    const code = l.toLowerCase().split(/[-_]/)[0];
    if (code === "es") return "es";
    if (code === "en") return "en";
  }
  return "en";
}

function browserLangs(): string[] {
  try {
    if (typeof navigator === "undefined") return [];
    return navigator.languages?.length ? [...navigator.languages] : navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}

export const resolveLang = (setting: LangSetting): Lang => (setting === "auto" ? deviceLang() : setting);

/** Switches the language. Returns true when it changed. */
export function setLang(l: Lang): boolean {
  const changed = l !== lang;
  lang = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
  return changed;
}

const fill = (s: string, vars?: Record<string, string | number>): string =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** Translates English text into the current language. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return fill(DICTS[lang]?.[key] ?? key, vars);
}

/** Picks the singular or plural English key by `n`, then translates it. `{n}` is filled in. */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : other, { n, ...vars });
}

/** The dictionary for a language (for tests). */
export const dictionary = (l: Lang): Record<string, string> => DICTS[l] ?? {};

// ---------- The page's fixed text ----------

/** English originals of the page's static text and attributes, read once. */
let staticText: { node: Text; en: string }[] | null = null;
let staticAttrs: { el: Element; attr: string; en: string }[] = [];
let staticHtml: { el: HTMLElement; en: string }[] = [];
const ATTRS = ["aria-label", "placeholder", "title"];

function collect(): void {
  staticText = [];
  staticAttrs = [];
  staticHtml = [];
  // Elements whose markup must move as a whole (word order differs between languages).
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach(el => staticHtml.push({ el, en: el.innerHTML.trim() }));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const p = n.parentElement;
      if (!p || p.closest("script,style,[data-i18n-html]")) return NodeFilter.FILTER_REJECT;
      return n.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) staticText.push({ node: n as Text, en: n.nodeValue! });
  document.body.querySelectorAll("*").forEach(el => {
    for (const attr of ATTRS) { const v = el.getAttribute(attr); if (v) staticAttrs.push({ el, attr, en: v }); }
  });
}

/** Puts the page's fixed text (from index.html) into the current language. Text the game
 *  writes later is translated where it's written. */
export function translateDom(): void {
  if (typeof document === "undefined") return;
  if (!staticText) collect();
  for (const { node, en } of staticText!) {
    if (!node.isConnected) continue;
    const key = en.trim(), lead = en.slice(0, en.indexOf(key)), tail = en.slice(en.indexOf(key) + key.length);
    node.nodeValue = lead + t(key) + tail;
  }
  for (const { el, attr, en } of staticAttrs) el.setAttribute(attr, t(en));
  for (const { el, en } of staticHtml) el.innerHTML = t(en);
}
