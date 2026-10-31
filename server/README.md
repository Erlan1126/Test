# Skyrise payments

Premium skins and islands are sold with **Stripe Checkout**. This folder is a small
**Cloudflare Worker** that:

1. creates a Stripe checkout page when a player taps a price in the Premium shop,
2. receives Stripe's confirmation once the payment goes through (the signature is checked),
3. remembers what each player owns, so the game can unlock it on any device that has
   their save code.

Purchases are cosmetic only. The game never unlocks a paid item by itself: it asks this
server what the player owns.

## What you need

- A **Stripe** account (stripe.com). Start in test mode: no real money moves.
- A free **Cloudflare** account (cloudflare.com) for the Worker.
- The game published on a real website (for example itch.io). Payments don't run inside
  the Claude page preview.

## Setup (about 30 minutes)

1. **Products in Stripe.** In the Stripe dashboard, create one product per item in
   `src/data/premium.ts` with the same prices (Crystal Palace $1.99, …, Founder's Pack
   $7.99). Copy each product's **price id** (`price_…`).
2. **Worker settings.** In `wrangler.toml`, paste the price ids and set `ALLOWED_ORIGINS`
   to your game's address (on itch.io, also keep `https://html-classic.itch.zone`, where
   itch serves HTML games).
3. **Storage.** Run `npx wrangler kv namespace create ENTITLEMENTS` and paste the id into
   `wrangler.toml`.
4. **Secrets.** Run `npx wrangler secret put STRIPE_SECRET_KEY` and paste your Stripe
   secret key (`sk_test_…` while testing).
5. **Deploy.** Run `npx wrangler deploy`. It prints the Worker's address, like
   `https://skyrise-pay.yourname.workers.dev`.
6. **Webhook.** In Stripe → Developers → Webhooks, add an endpoint at
   `<worker address>/webhook` for the events `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`. Copy its signing secret and run
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
7. **Connect the game.** Set `PAYMENTS_API` in `src/data/premium.ts` to the Worker's
   address, run `npm run build`, and upload the new `dist/`.
8. **Test** with Stripe's test card `4242 4242 4242 4242`. When everything works, switch
   the secret key and price ids to live mode.

## Before taking real money

- Add a **refund and support** contact, and terms and a privacy note on your game page.
- Stripe handles card details; the game and this server never see them.
- Purchases are tied to a random player id stored in the save. Moving progress with a save
  code moves purchases too. Anyone who gets a player's save code could also unlock their
  purchases, so tell players to keep codes private. Real accounts (sign-in) would fix
  this and are a good next step if sales grow.
- Some stores (Apple App Store, Google Play) require their own in-app purchase systems if
  you later ship Skyrise as a store app.

## Trying the flow without a server

Add `?testpay` to the game's address. The Premium shop then grants items instantly and
says clearly that it's test mode and nothing is charged.
