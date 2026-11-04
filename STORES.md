# Putting Skyrise on the App Store and Google Play

The phone apps are the same game wrapped as a native app with Capacitor (`android/`,
`ios/`). GitHub builds them for you (`.github/workflows/`), so you don't need a Mac or
Android Studio. This page lists the steps only you can do, because they need your own
accounts, payments and identity.

Store text, screenshots and product lists are ready in `launch/stores/`:

- `app-store.md`: every App Store Connect field
- `google-play.md`: every Play Console field
- `app-store-screenshots/`: 1290 × 2796
- `google-play-screenshots/`: 1080 × 2160
- `feature-graphic.png`: 1024 × 500

## Costs and timing

| | Google Play | App Store |
|---|---|---|
| Developer account | $25 once | $99 per year |
| Store's cut of sales | 15% (on your first $1M a year) | 15% (Small Business Program; apply for it) |
| Before you can go public | 12 testers for 14 days (new personal accounts) | App review, usually 1–2 days |
| Identity check | Government ID, can take a few days | Apple ID with two-factor, a day or two |

GitHub's Mac build machines use more of your free Actions minutes than Linux ones (each
Mac minute counts as 10). A Skyrise iPhone build takes about 10–15 minutes.

## Step 0: things both stores ask for

- [ ] **A contact email** that you check. Put it in `launch/privacy.md` and
      `launch/support-and-refunds.md` in place of `[your contact email]`.
- [ ] **A public privacy policy link.** The easiest way: go to https://gist.github.com,
      paste the contents of `launch/privacy.md`, name the file `privacy.md`, click
      **Create public gist**, and use that link. A Google Doc shared with "Anyone with the
      link" also works.

## Step 1: try the Android app on a phone today (free)

- [ ] On GitHub, open the repository → **Actions** → **Android app** → the latest green
      run → **Artifacts** → download `skyrise-debug-apk`.
- [ ] Unzip it and send `app-debug.apk` to an Android phone. Open it and allow
      "install unknown apps" when asked.
- [ ] Play a few towers. Check sound, vibration, the back button, sharing, and the
      daily reminder (🔥 streak button → Remind me every day).

This test build can't make purchases. Purchases only work in builds installed from the
store's own testing tracks.

## Step 2: Google Play

- [ ] Create a developer account at https://play.google.com/console/signup
      (Personal, $25) and finish the identity check.
- [ ] **Upload key:** Google needs every upload signed with your own key. Tell me when
      you get here and I'll create one for you, along with the four secrets to paste
      into GitHub. Keep the key file and its password somewhere safe (a password
      manager). If it's ever lost, Google can reset it, because Play App Signing holds
      the real app key.
- [ ] Add the secrets on GitHub: repository → **Settings** → **Secrets and variables**
      → **Actions** → **New repository secret**: `ANDROID_KEYSTORE_BASE64`,
      `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.
- [ ] Run the build again (Actions → Android app → **Run workflow**) and download
      `skyrise-release-aab`. That `.aab` file is what you upload to Google Play.
- [ ] In the Play Console: **Create app**, then fill in everything from
      `launch/stores/google-play.md`.
- [ ] Testing → **Closed testing**: upload the `.aab`, add at least 12 testers and send
      them the link. Wait 14 days.
- [ ] Create the 7 in-app products (Monetize → Products) and set up your payments profile.
- [ ] Apply for production and publish.

## Step 3: App Store

- [ ] Join the Apple Developer Program at https://developer.apple.com/programs/enroll
      (Individual, $99 a year).
- [ ] Register the app id: https://developer.apple.com/account/resources/identifiers →
      **+** → App IDs → App → description "Skyrise", Bundle ID **Explicit**:
      `com.erlan1126.skyrise`. Leave capabilities as they are; in-app purchase is on by default.
- [ ] Create the app in App Store Connect (My Apps → **+** → New App) using
      `launch/stores/app-store.md`.
- [ ] **Let GitHub sign and upload builds:** in App Store Connect → **Users and Access**
      → **Integrations** → **App Store Connect API** → Team Keys → **+**. Name it
      "GitHub", access **Admin**, then download the `.p8` file. It can only be downloaded once.
- [ ] Add four GitHub secrets (Settings → Secrets and variables → Actions):
  - `APPSTORE_KEY_ID`: the key's ID, shown next to it
  - `APPSTORE_ISSUER_ID`: the Issuer ID, shown at the top of that page
  - `APPSTORE_API_KEY_P8`: open the `.p8` file in a text editor and paste all of it
  - `APPLE_TEAM_ID`: from https://developer.apple.com/account → Membership details
- [ ] Run Actions → **iOS app** → **Run workflow**. When it's green, the build appears in
      App Store Connect → **TestFlight** after 10–30 minutes.
- [ ] Install **TestFlight** on your iPhone, add yourself as an internal tester, and play it.
- [ ] Business → **Agreements**: accept the Paid Apps Agreement and add bank and tax info.
- [ ] Create the 7 in-app purchases from `app-store.md`.
- [ ] On the 1.0 version page: pick the build, add screenshots and the in-app purchases,
      then **Add for Review** → **Submit**.

## Changing the app later

Every push to the branch makes new builds with a higher build number. For an update,
upload the new `.aab` to Google Play, and pick the new TestFlight build for a new App
Store version.

The app id `com.erlan1126.skyrise` can't change once the first build is uploaded to
either store. If you want a different one (for example `com.yourstudio.skyrise`), say
so before that first upload.
