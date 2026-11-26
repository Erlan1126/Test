# Lumen Rush phone apps (iPhone and Android)

Lumen Rush's iPhone and Android apps are the same game as `echo.html`, wrapped with
Capacitor (`android/`, `ios/`). App id: **`com.bigbrucestudios.lumenrush`** (it can't change
after the first upload to either store). Store text, screenshots and privacy answers are in
`store/lumen-rush/` on the Buildaroo branch (PR #33).

## How it's built

- `npm run build:app` makes `www/` (not committed): the one-file game from
  `tools/bundle-echo.js`, plus a small bridge so vibration uses the phone's haptics and
  Share opens the phone's share sheet. The website keeps using `echo.html`.
- `npx cap sync` copies `www/` into both phone projects.
- The apps are portrait only, iPhone only (no iPad), with the status bar hidden. Android's
  Back button goes back from a run to the home screen (the game already handles it).
- Icons and launch screens come from `assets/` (made from `echo-icon.svg`). To change them:
  replace the files and run `npx capacitor-assets generate --iconBackgroundColor '#05060f' --splashBackgroundColor '#05060f'`.

## Try it on an Android phone (free, no account)

GitHub → **Actions** → **Lumen Rush Android app** → the latest green run → **Artifacts** →
`lumen-rush-debug-apk`. Unzip, send `app-debug.apk` to the phone and open it. The same run
also starts the app on an Android emulator and saves a screenshot (`lumen-rush-emulator`).

## Google Play

Same upload key and the same four GitHub secrets as Buildaroo
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`); one upload key may sign several apps. With them set, each run also
makes `lumen-rush-release-aab` for the Play Console.

## App Store (TestFlight)

1. developer.apple.com → Identifiers → **+** → App ID → Bundle ID (explicit):
   `com.bigbrucestudios.lumenrush`, description "Lumen Rush".
2. App Store Connect → **+** New App: name `Lumen Rush`, bundle id above, SKU `lumenrush-ios-1`.
3. Codemagic → Start new build → this branch → **Lumen Rush iPhone app → TestFlight**
   (uses the same "App Store Connect key" integration as Buildaroo).

## Not done yet

- Progress is kept in the web view's local storage, like the website. That survives app
  updates; it's lost only if the app is deleted. A native backup (as Buildaroo has) would also
  survive iOS clearing web data under very low storage.
- Sharing from the app sends the text and link; the picture of your best moment is only
  shared on the website.
