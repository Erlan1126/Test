# Skyrise launch checklist

Everything in this folder is ready to use. The steps below are the ones only you can do,
because they need your own accounts, keys and decisions.

## Before you start

- [ ] Fill in `[your contact email]` in `privacy.md` and `support-and-refunds.md` (and
      anywhere you paste them). Use an address you'll actually check.
- [ ] Watch `trailer.mp4` and look through `cover.png` and `screenshots/` once yourself.

## 1. Create the itch.io account and project

- [ ] Sign up at https://itch.io (or log in) and fill in your creator profile.
- [ ] Dashboard → **Create new project**.
- [ ] Set **Kind of project** to **HTML**, and **Pricing** to **No payments**.
- [ ] Keep the project **Draft** while you set it up.

## 2. Upload and fill in the page

Use `itch-page.md` for every field.

- [ ] Title, short description (tagline), genre (Casual) and the 10 tags.
- [ ] Upload `skyrise-web.zip` and tick **This file will be played in the browser**.
- [ ] Embed options: 480 × 854, mobile friendly (portrait), fullscreen button on,
      "Automatically start on page load" off.
- [ ] Paste the description. Add the privacy note (`privacy.md`) and
      `support-and-refunds.md` at the bottom of the description, or link to them.
- [ ] Upload `cover.png` as the cover image and the five `screenshots/` in order.
- [ ] Save, then open the draft page on your phone **and** on a computer. Play one
      tower on each. Check sound starts after the first tap and fullscreen works.

## 3. Set up Stripe and Cloudflare (payments)

Follow `server/README.md` step by step (about 30 minutes). In short:

- [ ] Create a Stripe account and stay in **test mode**.
- [ ] Create one Stripe product per item in `src/data/premium.ts`, with the same prices
      (Crystal Palace, Sakura Spire, Royal Amethyst $1.99; Cyber City, Volcano Island,
      Candy Island $2.99; Founder's Pack $7.99). Copy each `price_…` id.
- [ ] Create a free Cloudflare account.
- [ ] In `server/wrangler.toml`: paste the price ids and set `ALLOWED_ORIGINS` to your
      itch.io page address **plus** `https://html-classic.itch.zone`.
- [ ] `npx wrangler kv namespace create ENTITLEMENTS` and paste the id into `wrangler.toml`.
- [ ] `npx wrangler secret put STRIPE_SECRET_KEY` (your `sk_test_…` key).
- [ ] `npx wrangler deploy` and note the Worker address.
- [ ] In Stripe → Developers → Webhooks, add `<worker address>/webhook` for
      `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then
      `npx wrangler secret put STRIPE_WEBHOOK_SECRET` with its signing secret.

## 4. Set PAYMENTS_API and rebuild

- [ ] In `src/data/premium.ts`, set `PAYMENTS_API` to your Worker address, for example
      `"https://skyrise-pay.yourname.workers.dev"`.
- [ ] `npm test` then `npm run build`.
- [ ] Rebuild the upload: `rm -f launch/skyrise-web.zip && cd dist && zip -qr ../launch/skyrise-web.zip . -x ".nojekyll"`.
- [ ] Upload the new `skyrise-web.zip` to itch.io (replace the old file).

## 5. Test with Stripe's test card

- [ ] On your itch.io draft page, open the Shop → Premium and buy one item.
- [ ] Pay with the test card **4242 4242 4242 4242**, any future expiry date, any CVC
      and any postcode.
- [ ] Check the item unlocks in the game, and the payment shows in Stripe (test mode).
- [ ] Copy your save code, load it in another browser, and check the item is there too.
- [ ] Try a refund in the Stripe dashboard so you know where the button is.

## 6. Go live

- [ ] In Stripe, finish account activation (business details and bank account).
- [ ] Recreate the products in **live mode** and put the live price ids in `wrangler.toml`.
- [ ] `npx wrangler secret put STRIPE_SECRET_KEY` with your live `sk_live_…` key, add a
      live-mode webhook, update `STRIPE_WEBHOOK_SECRET`, and `npx wrangler deploy`.
- [ ] Make one real small purchase yourself and refund it.
- [ ] On itch.io, set the project to **Public** and save.

## 7. Share it

- [ ] Send the itch.io link to friends and ask them to play on their phones.
- [ ] Upload `trailer.mp4` to YouTube (a Short works well, it's portrait) and add the
      link to the itch.io page.
- [ ] Post the trailer and link on the social sites you use, and in itch.io's
      community (for example a devlog post on your project).
- [ ] Read the comments for the first few days and note any bugs.

## Later

- [ ] **CrazyGames** (https://developer.crazygames.com): submit Skyrise as an HTML5 game.
      They review every game before it goes live, and they ask you to add their SDK
      (for things like gameplay start/stop events and their own ad and purchase rules).
      Check their current requirements on in-game purchases before submitting.
- [ ] **Poki** (https://developers.poki.com): apply through Poki for Developers. Poki
      also reviews games and requires the Poki SDK; they are selective, and their rules
      on outside payments may mean turning premium off for that build.
- [ ] Both portals may ask for a build without the service worker or with a different
      page size; keep a separate build for each if needed.
- [ ] If sales grow, consider real sign-in accounts so purchases aren't tied only to a
      save code (see `server/README.md`).
