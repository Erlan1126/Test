/** The little icons on the town's bubbles: one clear picture per kind of bubble (golden
 *  customer, ready to grow, VIP, critic, power cut, cash to collect, a request, for sale). */
const svg = (body: string) => `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const TAG_ICON = {
  /** A golden customer: a white star on gold. */
  star: svg(`<path d="M12 2.6l2.8 5.7 6.3.9-4.55 4.45 1.07 6.25L12 16.95l-5.62 2.95 1.07-6.25L2.9 9.2l6.3-.9z" fill="#fff" stroke="#b36a00" stroke-width="1.1" stroke-linejoin="round"/>`),
  /** Ready to grow: a fat up-arrow. */
  up: svg(`<path d="M12 3.5l7.5 8h-4.4V20.5H8.9v-9H4.5z" fill="#fff" stroke="#127a3c" stroke-width="1" stroke-linejoin="round"/>`),
  /** A VIP: a big sparkle and a small one. */
  sparkle: svg(`<path d="M10.5 3l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6L2 11.5l6.6-1.9z" fill="#fff"/><path d="M18.5 2.5l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z" fill="#ffe27a"/><path d="M18 15.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" fill="#ffe27a"/>`),
  /** A food critic: a notepad and a pencil. */
  note: svg(`<rect x="4" y="3.5" width="13" height="17" rx="2" fill="#fff"/><path d="M4 7h13" stroke="#ffb199" stroke-width="1.4"/><path d="M7 10.5h7M7 13.5h7M7 16.5h4" stroke="#e2482a" stroke-width="1.6" stroke-linecap="round"/><path d="M14.5 17.5l6-6 1.9 1.9-6 6-2.6.7z" fill="#ffd23a" stroke="#7a2a10" stroke-width=".9" stroke-linejoin="round"/>`),
  /** A power cut: a yellow bolt. */
  bolt: svg(`<path d="M13.8 2.5L4.8 13.6h6l-1.6 7.9 9.6-11.6h-6.2z" fill="#ffd23a" stroke="#fff3a8" stroke-width=".8" stroke-linejoin="round"/>`),
  /** Money waiting: a bundle of notes with a paper band. */
  cash: svg(`<rect x="2.5" y="9" width="16" height="9.5" rx="1.6" fill="#17914c" transform="rotate(-9 10.5 13.75)"/><rect x="5" y="7" width="16.5" height="10" rx="1.6" fill="#3ccf78" stroke="#12733c" stroke-width="1"/><circle cx="13.25" cy="12" r="2.4" fill="#eaffef" stroke="#12733c" stroke-width=".9"/><rect x="8.6" y="6.4" width="2.8" height="11.2" rx=".6" fill="#ffe27a" stroke="#b78400" stroke-width=".7"/>`),
  /** A request: three dots in a speech bubble (the bubble is the tag itself). */
  chat: svg(`<circle cx="6.5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="17.5" cy="12" r="2" fill="currentColor"/>`),
  /** For sale: a price tag. */
  price: svg(`<path d="M3 12V4.6A1.6 1.6 0 0 1 4.6 3H12l8.6 8.6a1.6 1.6 0 0 1 0 2.3l-6.7 6.7a1.6 1.6 0 0 1-2.3 0z" fill="#fff"/><circle cx="7.7" cy="7.7" r="1.8" fill="#6a3cff"/>`),
} as const;
