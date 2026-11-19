// The game's own icons, drawn as SVG so they look the same on every phone (emoji differ
// from Android to iPhone and read as amateur). Text everywhere in the UI still uses the
// emoji as a shorthand ("+3 ★", "🎁 Open your gift"); `startIcons()` swaps each one for
// its icon as text appears, so translations and game code don't need to change.

/** Shared gradients for the icons. */
const DEFS = `
<linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#ffc83d"/><stop offset="1" stop-color="#f08c00"/></linearGradient>
<linearGradient id="g-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9fbff"/><stop offset=".5" stop-color="#5fd3ff"/><stop offset="1" stop-color="#3b6cff"/></linearGradient>
<linearGradient id="g-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d6e"/><stop offset=".55" stop-color="#ff8a2b"/><stop offset="1" stop-color="#ffd43b"/></linearGradient>
<linearGradient id="g-pink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ac0"/><stop offset="1" stop-color="#f63476"/></linearGradient>
<linearGradient id="g-violet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a3ff"/><stop offset="1" stop-color="#6a3fe0"/></linearGradient>
<linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
<linearGradient id="g-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ff0b0"/><stop offset="1" stop-color="#2fb35a"/></linearGradient>
<linearGradient id="g-teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ff0de"/><stop offset="1" stop-color="#12998b"/></linearGradient>
<linearGradient id="g-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f7a"/><stop offset="1" stop-color="#1b1f4a"/></linearGradient>
<linearGradient id="g-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9b4c7"/></linearGradient>
<linearGradient id="g-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd2a8"/><stop offset="1" stop-color="#c46a2b"/></linearGradient>`;

const S = 'stroke="#2a1270" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
const shine = (d: string) => `<path d="${d}" fill="#fff" opacity=".45"/>`;

/** Each icon is drawn in a 24x24 box. */
const ICONS: Record<string, string> = {
  star: `<path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3L2.9 9.3l6.3-.9z" fill="url(#g-gold)" ${S}/>${shine("M12 5.2l1.6 3.3-3.3.6z")}`,
  starEmpty: `<path d="M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3L2.9 9.3l6.3-.9z" fill="#e3e6f2" stroke="#9aa0bf" stroke-width="1.4" stroke-linejoin="round"/>`,
  gem: `<path d="M6 3.5h12l3.5 5.2L12 21 2.5 8.7z" fill="url(#g-gem)" ${S}/><path d="M2.5 8.7h19M9 3.5L7.5 8.7 12 21l4.5-12.3L15 3.5" fill="none" stroke="#2a1270" stroke-width="1" opacity=".55"/>${shine("M7 4.6h3.2L8.6 8H4.6z")}`,
  trophy: `<path d="M7 3.5h10v5.3a5 5 0 0 1-10 0z" fill="url(#g-gold)" ${S}/><path d="M7 5H4.2v1.4A3.3 3.3 0 0 0 7.4 9.7M17 5h2.8v1.4a3.3 3.3 0 0 1-3.2 3.3" fill="none" ${S}/><path d="M12 13.8v3.4M8.3 20.5h7.4l-1-3.3H9.3z" fill="url(#g-gold)" ${S}/>${shine("M8.6 4.6h2v4.7a3 3 0 0 1-1.8-1.2z")}`,
  fire: `<path d="M12 21.5c-4.1 0-7-2.8-7-6.6 0-3.4 2.4-5.3 3.7-7.9.4 1.8 1.4 2.8 2.3 3.2-.3-3.4 1.2-6.4 3.6-7.7-.2 3 1.4 4.6 2.8 6.4 1.2 1.6 1.6 3 1.6 4.8 0 4.4-2.9 7.8-7 7.8z" fill="url(#g-fire)" ${S}/><path d="M12 21c-1.9 0-3.1-1.3-3.1-3.1 0-1.6 1.1-2.6 1.9-3.8.3 1 .9 1.5 1.4 1.7.1-1.5.8-2.5 1.6-3.1.2 1.7 1.4 2.6 1.4 4.6 0 2.2-1.4 3.7-3.2 3.7z" fill="#fff4a8"/>`,
  city: `<path d="M3 21V10.5l5-3V21M8 21V4.5l7.5 3V21M15.5 21v-9l5.5 2.5V21z" fill="url(#g-sky)" ${S}/><path d="M10.5 9h2.5M10.5 12h2.5M10.5 15h2.5M5 13h1.4M5 16h1.4M17.5 16h1.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M2 21h20" ${S}/>`,
  crown: `<path d="M3.5 18l-1.2-10 5.4 4.2L12 5l4.3 7.2 5.4-4.2-1.2 10z" fill="url(#g-gold)" ${S}/><path d="M3.5 20.5h17" ${S}/><circle cx="12" cy="14.5" r="1.6" fill="#f63476"/>`,
  gift: `<path d="M3.5 9h17v4h-17zM5 13h14v8H5z" fill="url(#g-pink)" ${S}/><path d="M12 9v12" stroke="#ffd43b" stroke-width="2.6"/><path d="M12 8.8C9 4 5.6 5.2 6.6 7.6c.6 1.3 3 1.3 5.4 1.2zm0 0c3-4.8 6.4-3.6 5.4-1.2-.6 1.3-3 1.3-5.4 1.2z" fill="url(#g-gold)" ${S}/>`,
  check: `<circle cx="12" cy="12" r="9.5" fill="url(#g-green)" ${S}/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  tick: `<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  leaf: `<path d="M4.5 19.5C4 11 9 4.5 20 4c.4 9.8-5.2 16-15.5 15.5z" fill="url(#g-green)" ${S}/><path d="M4.5 19.5C8 15 11.5 11.5 16 8.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="#fff" ${S}/><path d="M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2h-17z" fill="url(#g-pink)" ${S}/><path d="M8 3v4M16 3v4" ${S}/><circle cx="12" cy="15.3" r="2.6" fill="url(#g-gold)" ${S}/>`,
  map: `<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z" fill="url(#g-teal)" ${S}/><path d="M9 3.5v14.5M15 6v14.5" stroke="#2a1270" stroke-width="1" opacity=".5"/><path d="M6 15c2-3 4 1 6-2s4 0 6-3" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1.5 2" stroke-linecap="round"/><circle cx="18" cy="10" r="1.6" fill="#f63476"/>`,
  bolt: `<path d="M13.5 2.5L4.5 13.5h6.2l-1.5 8 9.3-11.2h-6.3z" fill="url(#g-gold)" ${S}/>`,
  ghost: `<path d="M5 20.5V10a7 7 0 0 1 14 0v10.5l-2.4-1.7-2.3 1.7-2.3-1.7-2.3 1.7-2.3-1.7z" fill="url(#g-violet)" ${S}/><circle cx="9.5" cy="10.5" r="1.5" fill="#fff"/><circle cx="14.5" cy="10.5" r="1.5" fill="#fff"/>`,
  target: `<circle cx="12" cy="12" r="9.5" fill="#fff" ${S}/><circle cx="12" cy="12" r="6.3" fill="url(#g-pink)" ${S}/><circle cx="12" cy="12" r="3" fill="#fff" ${S}/><circle cx="12" cy="12" r="1.1" fill="#2a1270"/>`,
  brick: `<rect x="3" y="5" width="18" height="14" rx="2" fill="url(#g-bronze)" ${S}/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19" stroke="#2a1270" stroke-width="1" opacity=".6"/>`,
  sun: `<circle cx="12" cy="12" r="4.8" fill="url(#g-gold)" ${S}/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="#f08c00" stroke-width="2" stroke-linecap="round"/>`,
  sparkle: `<path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" fill="url(#g-gold)" ${S}/>`,
  magnet: `<path d="M5 4h4.5v8a2.5 2.5 0 0 0 5 0V4H19v8a7 7 0 0 1-14 0z" fill="url(#g-pink)" ${S}/><path d="M5 4h4.5v3H5zM14.5 4H19v3h-4.5z" fill="url(#g-silver)" ${S}/>`,
  bank: `<path d="M3 9.5L12 4l9 5.5z" fill="url(#g-gold)" ${S}/><path d="M5 10.5v7M9.7 10.5v7M14.3 10.5v7M19 10.5v7" stroke="#2a1270" stroke-width="2.4" stroke-linecap="round"/><path d="M3 19.5h18" ${S}/>`,
  chest: `<path d="M3.5 10.5h17V20h-17z" fill="url(#g-bronze)" ${S}/><path d="M3.5 10.5a8.5 5.5 0 0 1 17 0z" fill="url(#g-gold)" ${S}/><rect x="10.3" y="10" width="3.4" height="4.4" rx="1" fill="url(#g-silver)" ${S}/>`,
  film: `<rect x="3" y="6" width="13.5" height="12" rx="2.5" fill="url(#g-violet)" ${S}/><path d="M16.5 10.5l4.5-2.8v8.6l-4.5-2.8z" fill="url(#g-violet)" ${S}/>`,
  party: `<path d="M4 20.5l4.2-12 7.8 7.8z" fill="url(#g-gold)" ${S}/><circle cx="15.5" cy="5" r="1.4" fill="#f63476"/><circle cx="19.5" cy="9.5" r="1.2" fill="#3b82f6"/><path d="M12 4.5c.8 1.4.2 2.6-.7 3.3M18.5 13c-1.4-.7-2.7-.2-3.3.8" fill="none" stroke="#2fb35a" stroke-width="1.6" stroke-linecap="round"/>`,
  swords: `<path d="M4 4l9 9M20 4l-9 9" stroke="url(#g-silver)" stroke-width="3" stroke-linecap="round"/><path d="M4 4l9 9M20 4l-9 9" fill="none" stroke="#2a1270" stroke-width=".9"/><path d="M6.5 15.5l3 3M17.5 15.5l-3 3M5 20l2.5-2.5M19 20l-2.5-2.5" stroke="#c46a2b" stroke-width="2.4" stroke-linecap="round"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="url(#g-ink)" ${S}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#4a4f7a" stroke-width="2.4"/><circle cx="12" cy="15.5" r="1.5" fill="#fff"/>`,
  tower: `<path d="M8 21V6.5l4-3 4 3V21z" fill="url(#g-sky)" ${S}/><path d="M10.3 9h3.4M10.3 12h3.4M10.3 15h3.4M10.3 18h3.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M5 21h14" ${S}/>`,
  home: `<path d="M4 11L12 4l8 7v9.5H4z" fill="url(#g-sky)" ${S}/><path d="M10 20.5v-5h4v5" fill="#fff" ${S}/>`,
  medal1: `<path d="M8 2.5h3l1 5-3 1zM16 2.5h-3l-1 5 3 1z" fill="url(#g-pink)" ${S}/><circle cx="12" cy="15" r="6.5" fill="url(#g-gold)" ${S}/><path d="M11 13l1.4-1v6" fill="none" stroke="#2a1270" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  medal2: `<path d="M8 2.5h3l1 5-3 1zM16 2.5h-3l-1 5 3 1z" fill="url(#g-sky)" ${S}/><circle cx="12" cy="15" r="6.5" fill="url(#g-silver)" ${S}/><path d="M10.2 13a1.9 1.9 0 0 1 3.6.6c0 1.6-3.6 2.6-3.6 4.2h3.8" fill="none" stroke="#2a1270" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  medal3: `<path d="M8 2.5h3l1 5-3 1zM16 2.5h-3l-1 5 3 1z" fill="url(#g-teal)" ${S}/><circle cx="12" cy="15" r="6.5" fill="url(#g-bronze)" ${S}/><path d="M10.4 12.4h3.2l-1.8 2.1c1.4 0 2.1.7 2.1 1.7 0 1.9-2.8 2.2-3.7 1" fill="none" stroke="#2a1270" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  medal: `<path d="M8 2.5h3l1 5-3 1zM16 2.5h-3l-1 5 3 1z" fill="url(#g-pink)" ${S}/><circle cx="12" cy="15" r="6.5" fill="url(#g-gold)" ${S}/><path d="M12 11.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#fff"/>`,
  flag: `<path d="M5 21V3.5" ${S}/><path d="M5 4h13l-2.5 4 2.5 4H5z" fill="url(#g-pink)" ${S}/>`,
  ice: `<path d="M12 2.5l8.2 4.8v9.4L12 21.5l-8.2-4.8V7.3z" fill="url(#g-gem)" ${S}/><path d="M12 2.5v19M3.8 7.3l16.4 9.4M20.2 7.3L3.8 16.7" stroke="#fff" stroke-width="1" opacity=".7"/>`,
  sound: `<path d="M4 9.5h4l5-4.5v14l-5-4.5H4z" fill="url(#g-sky)" ${S}/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="#2a1270" stroke-width="1.8" stroke-linecap="round"/>`,
  music: `<path d="M9 17.5V5.5l11-2.5v12" fill="none" ${S}/><circle cx="6.5" cy="17.5" r="2.8" fill="url(#g-pink)" ${S}/><circle cx="17.5" cy="15" r="2.8" fill="url(#g-pink)" ${S}/><path d="M9 8.5l11-2.5" ${S}/>`,
  vibrate: `<rect x="7.5" y="3" width="9" height="18" rx="2.2" fill="url(#g-ink)" ${S}/><rect x="9" y="5" width="6" height="11.5" rx="1" fill="url(#g-sky)"/><path d="M4.5 8v8M19.5 8v8M2.5 10v4M21.5 10v4" stroke="#2a1270" stroke-width="1.6" stroke-linecap="round"/>`,
  globe: `<circle cx="12" cy="12" r="9.5" fill="url(#g-sky)" ${S}/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" fill="none" stroke="#fff" stroke-width="1.3"/>`,
  bulb: `<path d="M12 2.5a6.5 6.5 0 0 1 3.8 11.8c-.7.5-1.1 1.2-1.1 2V17H9.3v-.7c0-.8-.4-1.5-1.1-2A6.5 6.5 0 0 1 12 2.5z" fill="url(#g-gold)" ${S}/><path d="M9.3 19h5.4M10.3 21.3h3.4" ${S}/>`,
  cloud: `<path d="M7 19a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.4A3.8 3.8 0 0 1 17.5 19z" fill="url(#g-silver)" ${S}/>`,
  phone: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" fill="url(#g-ink)" ${S}/><rect x="8" y="5" width="8" height="12.5" rx="1" fill="url(#g-sky)"/><circle cx="12" cy="19.5" r=".9" fill="#fff"/>`,
  mail: `<rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="#fff" ${S}/><path d="M3.5 7l8.5 6.5L20.5 7" fill="none" ${S}/><circle cx="18.5" cy="6.5" r="3" fill="#f63476" ${S}/>`,
  pointer: `<path d="M9 13V4.5a1.6 1.6 0 0 1 3.2 0v6l5 1a2.2 2.2 0 0 1 1.8 2.6l-1.3 6.4H9.5l-3.3-4.6a1.6 1.6 0 0 1 2.4-2.1z" fill="#fff" ${S}/>`,
  mapPin: `<path d="M12 21.5s-6.5-6.4-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11.5-6.5 11.5z" fill="url(#g-pink)" ${S}/><circle cx="12" cy="10" r="2.5" fill="#fff"/>`,
  island: `<path d="M3 13h18l-3.5 3-3 4.5H9.5l-3-4.5z" fill="url(#g-bronze)" ${S}/><path d="M3 13c2-2 4-2.5 9-2.5s7 .5 9 2.5z" fill="url(#g-green)" ${S}/><path d="M10 10.5V5M10 5c2-1.5 4-1 5 1-2-.2-3.5 0-5-1zM10 5c-2-1.5-4-.8-5 1 2-.4 3.5 0 5-1z" fill="url(#g-green)" ${S}/>`,
  building: `<path d="M5 21V8l7-4.5L19 8v13z" fill="url(#g-violet)" ${S}/><path d="M8.5 10.5h2M13.5 10.5h2M8.5 14h2M13.5 14h2M10.5 21v-3.5h3V21" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
  wheel: `<circle cx="12" cy="10.5" r="7.5" fill="none" stroke="url(#g-pink)" stroke-width="2.4"/><path d="M12 3v15M4.5 10.5h15M6.7 5.2l10.6 10.6M17.3 5.2L6.7 15.8" stroke="#2a1270" stroke-width="1" opacity=".6"/><path d="M8 21.5l4-11 4 11" fill="none" ${S}/>`,
  rocket: `<path d="M12 2.5c3.5 2.5 5 6.5 4.5 11.5h-9C7 9 8.5 5 12 2.5z" fill="url(#g-silver)" ${S}/><circle cx="12" cy="9" r="1.8" fill="url(#g-sky)" ${S}/><path d="M7.5 14l-2.5 3.5h3.5M16.5 14l2.5 3.5h-3.5" fill="url(#g-pink)" ${S}/><path d="M10 15.5c0 3 2 5.5 2 5.5s2-2.5 2-5.5" fill="url(#g-fire)"/>`,
  coffee: `<path d="M4.5 8.5h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z" fill="#fff" ${S}/><path d="M16.5 10h1.5a2.5 2.5 0 0 1 0 5h-1.8" fill="none" ${S}/><path d="M8 3.5c-1 1.2 1 1.8 0 3M11.5 3.5c-1 1.2 1 1.8 0 3" fill="none" stroke="#9aa0bf" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 11h12" stroke="#c46a2b" stroke-width="2"/>`,
  flower: `<path d="M12 13v8" stroke="#2f9e5a" stroke-width="2" stroke-linecap="round"/><path d="M12 18c-2.5-.2-4-1.6-4.5-3.6 2.2-.2 3.8.9 4.5 3.6z" fill="url(#g-green)"/><g ${S}><circle cx="12" cy="5.6" r="2.9" fill="url(#g-pink)"/><circle cx="16.2" cy="8.6" r="2.9" fill="url(#g-pink)"/><circle cx="14.6" cy="13.2" r="2.9" fill="url(#g-pink)"/><circle cx="9.4" cy="13.2" r="2.9" fill="url(#g-pink)"/><circle cx="7.8" cy="8.6" r="2.9" fill="url(#g-pink)"/></g><circle cx="12" cy="9.7" r="2.4" fill="#ffd23a" ${S}/>`,
  slide: `<path d="M4 20.5V8h4v12.5" fill="url(#g-sky)" ${S}/><path d="M8 9c4 0 6 3 8 7l3 4.5" fill="none" stroke="url(#g-pink)" stroke-width="3.2" stroke-linecap="round"/><path d="M8 9c4 0 6 3 8 7l3 4.5" fill="none" stroke="#2a1270" stroke-width=".8"/><path d="M4 12h4M4 16h4" stroke="#2a1270" stroke-width="1.2"/>`,
  statue: `<rect x="7" y="16" width="10" height="5" rx="1" fill="url(#g-silver)" ${S}/><circle cx="12" cy="5" r="2.2" fill="url(#g-gold)" ${S}/><path d="M9.5 16l.5-6.5h4l.5 6.5z" fill="url(#g-gold)" ${S}/>`,
  windmill: `<path d="M9.5 21l1.2-10h2.6l1.2 10z" fill="#fff" ${S}/><path d="M12 9.5L12 3M12 9.5l6 2.5M12 9.5L6 12M12 9.5l3-6" stroke="#c46a2b" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="9.5" r="1.4" fill="url(#g-gold)" ${S}/>`,
  telescope: `<path d="M3.5 13.5l12-6 1.8 3.6-12 6z" fill="url(#g-violet)" ${S}/><path d="M17.3 11.1l3.2-1.6-1.8-3.6-3.2 1.6" fill="url(#g-sky)" ${S}/><path d="M10.5 14l-3 7M11.5 14l3 7" ${S}/>`,
  lighthouse: `<path d="M9 21l1-12h4l1 12z" fill="#fff" ${S}/><path d="M9.6 14h4.8M9.3 18h5.4" stroke="#f63476" stroke-width="2.2"/><path d="M9.5 9l.5-3h4l.5 3z" fill="url(#g-gold)" ${S}/><path d="M12 3.5v2.5" ${S}/><path d="M14.5 7.5L21 5.5v4z" fill="#ffe8a3" opacity=".9"/>`,
  carousel: `<path d="M3 9.5L12 4l9 5.5z" fill="url(#g-pink)" ${S}/><path d="M3.5 9.5h17" ${S}/><path d="M7 9.5V18M12 9.5V18M17 9.5V18" stroke="url(#g-gold)" stroke-width="1.6"/><path d="M4 18h16v2.5H4z" fill="url(#g-silver)" ${S}/><circle cx="7" cy="14" r="1.6" fill="#fff" ${S}/><circle cx="17" cy="13" r="1.6" fill="#fff" ${S}/>`,
  clock: `<path d="M7.5 21V8h9v13z" fill="url(#g-bronze)" ${S}/><path d="M6.5 8L12 3l5.5 5z" fill="url(#g-teal)" ${S}/><circle cx="12" cy="12.5" r="3" fill="#fff" ${S}/><path d="M12 11v1.5l1 .8" fill="none" stroke="#2a1270" stroke-width="1.2" stroke-linecap="round"/>`,
  dish: `<path d="M4 9.5a8 8 0 0 0 13.5 5.8z" fill="url(#g-silver)" ${S}/><path d="M10.8 12.5l5-5" ${S}/><circle cx="16.3" cy="7" r="1.4" fill="#f63476" ${S}/><path d="M9 15.5l-2 5.5h7l-2-5" fill="url(#g-ink)" ${S}/>`,
  balloon: `<path d="M12 2.5a6.5 6.5 0 0 1 6.5 6.8c0 3.5-3.4 6.4-4.5 7.7h-4C8.9 15.7 5.5 12.8 5.5 9.3A6.5 6.5 0 0 1 12 2.5z" fill="url(#g-pink)" ${S}/><path d="M12 2.5c-2 2-2.5 9.5 0 14.5M12 2.5c2 2 2.5 9.5 0 14.5" fill="none" stroke="#ffd43b" stroke-width="1.4"/><rect x="9.8" y="18.5" width="4.4" height="3" rx=".8" fill="url(#g-bronze)" ${S}/>`,
  pagoda: `<path d="M5 9.5h14L16 7H8zM6.5 14.5h11L15.3 12H8.7zM8 19.5h8l-1.7-2.5H9.7z" fill="url(#g-pink)" ${S}/><path d="M9 9.5V12M15 9.5V12M10 14.5V17M14 14.5V17" ${S}/><path d="M12 3v4" ${S}/><path d="M6 21h12" ${S}/>`,
  stadium: `<ellipse cx="12" cy="13" rx="9.5" ry="5.5" fill="url(#g-silver)" ${S}/><ellipse cx="12" cy="13" rx="6" ry="3" fill="url(#g-green)" ${S}/><path d="M3.5 6v5M20.5 6v5" ${S}/><circle cx="3.5" cy="5.5" r="1.3" fill="url(#g-gold)" ${S}/><circle cx="20.5" cy="5.5" r="1.3" fill="url(#g-gold)" ${S}/>`,
  airship: `<ellipse cx="12" cy="9.5" rx="9" ry="4.5" fill="url(#g-silver)" ${S}/><path d="M3.5 9.5L1.5 6.5M3.5 9.5L1.5 12.5" ${S}/><rect x="9.5" y="14" width="5" height="2.6" rx="1" fill="url(#g-ink)" ${S}/><path d="M7 9.5h10" stroke="#f63476" stroke-width="1.6"/>`,
};

/** The emoji (or symbol) each icon stands in for. */
const EMOJI: Record<string, string> = {
  "★": "star", "⭐": "star", "☆": "starEmpty", "💎": "gem", "🏆": "trophy", "🔥": "fire", "🏙": "city", "🌆": "city", "🌇": "city", "🏢": "building",
  "👑": "crown", "🎁": "gift", "✅": "check", "🍃": "leaf", "📅": "calendar", "🗺": "map", "⚡": "bolt", "👻": "ghost", "🎯": "target", "🧱": "brick",
  "☀": "sun", "✨": "sparkle", "✦": "sparkle", "🧲": "magnet", "🏦": "bank", "🧰": "chest", "🎬": "film", "🎉": "party", "⚔": "swords", "🔒": "lock",
  "🗼": "lighthouse", "🏯": "pagoda", "🏗": "tower", "🏠": "home", "🔊": "sound", "🎵": "music", "📳": "vibrate", "🌐": "globe", "🌍": "globe", "💡": "bulb",
  "☁": "cloud", "📲": "phone", "📮": "mail", "📭": "mail", "👆": "pointer", "🏅": "medal", "🥇": "medal1", "🥈": "medal2", "🥉": "medal3", "🧊": "ice",
  "🏁": "flag", "⚑": "flag", "🏰": "building", "🏛": "building", "🕌": "building", "⛩": "pagoda", "🎡": "wheel", "☕": "coffee", "🛝": "slide", "🗽": "statue",
  "🌾": "windmill", "🔭": "telescope", "🎠": "carousel", "🕰": "clock", "📡": "dish", "🎈": "balloon", "🏟": "stadium", "🚀": "rocket", "🛸": "airship",
  "🏝": "island", "📍": "mapPin", "📖": "bulb", "🧭": "map", "🔨": "brick", "👷": "crown",
};

const CHARS = Object.keys(EMOJI).sort((a, b) => b.length - a.length).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
// An emoji may carry a variation selector (U+FE0F) after it.
const FIND = new RegExp(`(${CHARS.join("|")})️?`, "u");
const FIND_ALL = new RegExp(FIND.source, "gu");

export const iconSvg = (name: string, cls = ""): string =>
  `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${name}"/></svg>`;

/** HTML with every known emoji swapped for its icon (the text must already be escaped). */
export const withIcons = (html: string): string => html.replace(FIND_ALL, (_m, c: string) => iconSvg(EMOJI[c]));

/** Icons (and text pieces) made for a text node, removed if its text changes again. */
const made = new WeakMap<Text, Node[]>();

/** Replaces the emoji in one text node with icons. The node itself stays in the page (it
 *  keeps the last piece of text), so code that later rewrites its text (translations) still
 *  works: the old icons are removed and new ones made. */
function swapNode(node: Text): void {
  // Our own rewrite of this node comes back as a change: nothing to do.
  if (wrote.get(node) === node.nodeValue && made.has(node)) return;
  const old = made.get(node);
  if (old) { old.forEach(n => n.parentNode?.removeChild(n)); made.delete(node); }
  const text = node.nodeValue ?? "";
  if (!FIND.test(text) || !node.parentNode) return;
  const extra: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(FIND_ALL)) {
    if (m.index! > last) extra.push(document.createTextNode(text.slice(last, m.index)));
    const tpl = document.createElement("template");
    tpl.innerHTML = iconSvg(EMOJI[m[1]]);
    extra.push(tpl.content.firstChild!);
    last = m.index! + m[0].length;
  }
  for (const n of extra) node.parentNode.insertBefore(n, node);
  made.set(node, extra);
  node.nodeValue = text.slice(last);
  wrote.set(node, node.nodeValue);
}
/** The text this file last left in a node, to tell its own rewrites from real changes. */
const wrote = new WeakMap<Text, string>();

function swapTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { swapNode(root as Text); return; }
  if (!(root instanceof Element) || root.closest("script,style,svg,textarea,input,[data-no-icons]")) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (FIND.test(n.nodeValue ?? "")) list.push(n as Text);
  list.forEach(swapNode);
}

/** Puts the icon sprite on the page and swaps emoji for icons from now on. */
export function startIcons(): void {
  if (typeof document === "undefined") return;
  // Not display:none: browsers don't paint gradients defined inside a hidden element.
  const sprite = document.createElement("div");
  sprite.setAttribute("aria-hidden", "true");
  sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  sprite.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" data-no-icons><defs>${DEFS}${Object.entries(ICONS).map(([k, v]) => `<symbol id="ic-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")}</defs></svg>`;
  document.body.prepend(sprite);
  swapTree(document.body);
  new MutationObserver(records => {
    for (const r of records) {
      if (r.type === "characterData") {
        if (r.target.parentElement && !r.target.parentElement.closest("svg,[data-no-icons]")) swapNode(r.target as Text); continue; }
      r.addedNodes.forEach(n => { if (!(n instanceof SVGElement)) swapTree(n); });
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
