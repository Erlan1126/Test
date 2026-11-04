# Skyrise server

One small **Cloudflare Worker** (free plan is plenty) that does two jobs:

1. **Worldwide rankings** for the apps and the website. After each Classic or Daily
   tower, the game sends the tower's seed and the timing of each tap. The server
   **replays the tower with the same game rules** (it imports `src/logic/replay.ts`) and
   ranks the score it computes itself, so a made-up score can't get onto the board. It
   keeps today's Daily, this week's and all-time boards in a **D1** database.
2. **Sky Crystal packs on the website** with Stripe Checkout (optional). The phone apps
   sell packs through the App Store and Google Play and don't need this part.

## Part 1: worldwide rankings (about 10 minutes, works from an iPad)

GitHub deploys the server for you (`.github/workflows/server.yml`). You only need a free
Cloudflare account and two secrets:

1. Sign up at **dash.cloudflare.com** (free plan).
2. **Account id:** on the dashboard home, open **Workers & Pages**; the **Account ID** is
   in the right-hand column. Copy it.
3. **API token:** profile icon → **My Profile** → **API Tokens** → **Create Token** → use
   the **Edit Cloudflare Workers** template. Under **Permissions**, add one more row:
   **Account → D1 → Edit**. Then **Continue to summary** → **Create Token**, and copy it
   (it's shown once).
4. On GitHub: repository → **Settings** → **Secrets and variables** → **Actions** → add
   `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
5. Actions → **Server** → **Run workflow**. When it's green, its summary shows the
   server's address, like `https://skyrise.yourname.workers.dev`.
6. In the game, set `SERVER_URL` in `src/data/server.ts` to that address (or ask Claude
   to), and the next app build has worldwide rankings.

To check it's running, open `<address>/board?board=all&period=0` in a browser: it should
show an empty board.

With a computer instead: from this folder run `npx wrangler login`,
`npx wrangler d1 create skyrise` (paste its id into `wrangler.toml`),
`npx wrangler d1 execute skyrise --remote --file=schema.sql`, then `npx wrangler deploy`.

**Moderation:** names are cleaned (letters, numbers and a little punctuation, 16
characters) and a short list of offensive words is blocked. To change a name by hand,
use the D1 console in the Cloudflare dashboard:
`UPDATE players SET name = '' WHERE name = 'bad name';`
To delete a player who asks (privacy requests):
`DELETE FROM scores WHERE player = '<id>'; DELETE FROM players WHERE id = '<id>';`

## Part 2: crystal packs on the website (optional, about 30 minutes)

Only if you sell on a website (the apps don't need this).

1. **Stripe.** Create a Stripe account and stay in test mode. Create one product per pack
   in `src/data/premium.ts` (`CRYSTAL_PACKS`) with the same prices and copy each **price id**.
2. **Settings.** In `wrangler.toml`, paste the price ids, set `ALLOWED_ORIGINS` to your
   website, and uncomment the `ENTITLEMENTS` KV block after running
   `npx wrangler kv namespace create ENTITLEMENTS`.
3. **Secrets.** `npx wrangler secret put STRIPE_SECRET_KEY` (your `sk_test_…` key).
4. **Deploy** again with `npx wrangler deploy`.
5. **Webhook.** In Stripe → Developers → Webhooks, add `<address>/webhook` for the events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET` with its signing secret.
6. In the game, set `WEB_PAYMENTS = true` in `src/data/server.ts` and rebuild.
7. Test with Stripe's card `4242 4242 4242 4242`, then switch to live keys and prices.

## How it fits together

| Route | What it does |
|---|---|
| `POST /players` | Registers a new random player id once and returns its private token |
| `POST /runs` | Replays a tower and saves the player's best on each board |
| `GET /board` | Top 100 of a board, plus your own rank |
| `POST /checkout` | Website only: starts a Stripe checkout for a crystal pack |
| `POST /webhook` | Website only: Stripe confirms a payment (signature checked) |
| `GET /entitlements` | Website only: packs bought, so the game adds each once |

Tests for all of this are in `tests/rankings.test.ts` and `tests/worker.test.js`.

## Trying purchases without a server

Add `?testpay` to the game's address. Crystal packs are then added instantly and the shop
says clearly that it's test mode and nothing is charged.
