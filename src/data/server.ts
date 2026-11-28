/**
 * Where the Skyrise server lives once it's deployed (see server/README.md), for example
 * "https://skyrise.yourname.workers.dev". It runs the worldwide rankings and sells crystal
 * packs on the website. While it's empty, the rankings use the shared claude.ai page when
 * the game runs there and are hidden elsewhere, and website crystal packs show "coming soon".
 */
export const SERVER_URL: string = "https://skyrise.erlanstudios.workers.dev";

/**
 * Sell crystal packs on the website through Stripe (needs the Stripe setup in
 * server/README.md). The phone apps always use the App Store and Google Play instead.
 */
export const WEB_PAYMENTS: boolean = false;

/**
 * Optional: also send crash and error reports to Sentry (sentry.io, free plan). Paste the
 * project's DSN here (one project per game), e.g. "https://abc123@o123.ingest.us.sentry.io/456" (Sentry → Settings
 * → Projects → this game → Client Keys). While it's empty, errors go only to our own server.
 */
export const SENTRY_DSN: Record<"skyrise" | "buildaroo", string> = { skyrise: "", buildaroo: "" };
