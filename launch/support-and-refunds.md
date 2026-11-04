# Skyrise support and refunds

Skyrise is made by Erlan Studios.

## Getting help

Something not working, or a purchase that didn't unlock? Email erlanstudios1@gmail.com.
It helps to include:

- what happened and what you expected,
- your device and whether you play in the app or a browser (for example "Pixel 8, app"),
- for purchase problems: the email on your Stripe receipt and your save code.

Most purchase problems are fixed by reopening the game, so it can check with the
payment server again.

## Refunds

Premium items are cosmetic and optional.

- **Bought in the Android or iPhone app:** refunds go through the store you paid. On
  Android, open Google Play → Profile → Payments & subscriptions → Budget & history, or
  ask at https://support.google.com/googleplay/workflow/9813244. On iPhone, go to
  https://reportaproblem.apple.com. In the app, **Shop → Premium → Restore purchases**
  brings back items you already own on a new phone.
- **Bought on the website:** ask for a refund within 14 days by emailing
  erlanstudios1@gmail.com with the email on your receipt. We'll refund the full price
  through Stripe. Refunds usually show up on your statement within 5 to 10 business days.

<!-- Note for the owner: refunds are issued by hand in the Stripe dashboard
(Payments → the payment → Refund). The payment server does not remove refunded items
automatically; if you want to take an item back, delete its id from the player's
`player:<id>` entry in the ENTITLEMENTS KV store in the Cloudflare dashboard. -->


## Moving your progress to another device

Your progress is saved in your browser on this device. To carry it to another phone,
tablet or computer:

1. On your current device, open **Settings → Move progress to another device**.
2. Tap **Copy my save code** and send the code to yourself.
3. On the new device, open the game, go to the same place in Settings, paste the code
   into the box and tap **Load save code**.

Your premium items come along with your save code. Keep the code private: anyone who has
it can load your progress and purchases.
