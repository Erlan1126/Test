# Building the iPhone app

The app is `index.html` (the same page GitHub Pages serves). [Capacitor](https://capacitorjs.com) wraps it
into a real iPhone app in the `ios/` folder and adds what a web page can't do:

- **Reminders**: iPhone notifications when tasks are due (tasks without a time remind at 9:00 AM)
- **Haptics**: a light tap when you finish a task, a success buzz when today is all done
- **Backup**: "Save a backup file" opens the Share sheet (Save to Files, AirDrop, Messages)

App ID: `com.erlan1126.todo` (set in `capacitor.config.json` and the Xcode project).
Choose it carefully before the first upload: it can't be changed after the app exists in App Store Connect.

## After changing the app

Whenever `index.html` changes, copy it into the iPhone project:

```sh
npm install      # first time only
npm run sync     # copies the app into ios/
```

## Option A: with a Mac (free to try on your own iPhone)

1. Install **Xcode** from the Mac App Store.
2. In this folder, run `npm install` and `npm run sync`, then `npm run open` to open the project in Xcode.
3. Plug in your iPhone. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** (it restarts).
4. In Xcode, click **App** in the left sidebar → **Signing & Capabilities** → **Team** → add your Apple ID.
5. Pick your iPhone at the top of the window and press **▶ Run**.

With a free Apple ID the app stops opening after 7 days; press Run again to reinstall.
With the paid Apple Developer account, use **Product → Archive** to upload to TestFlight and the App Store.

## Option B: without a Mac (Codemagic, needs the paid Apple Developer account)

`codemagic.yaml` builds the app on Codemagic's Macs and sends it to TestFlight.

1. In [App Store Connect](https://appstoreconnect.apple.com) → **Apps → +** → **New App**:
   platform iOS, name, bundle ID `com.erlan1126.todo`, SKU `todo`. Note the app's **Apple ID** number
   (App Information page).
2. In App Store Connect → **Users and Access → Integrations → App Store Connect API**, create a key
   with **App Manager** access and download the `.p8` file (it can only be downloaded once).
3. Sign up at [codemagic.io](https://codemagic.io) with GitHub and add this repository.
4. In Codemagic → **Team settings → Integrations → Developer Portal**, add the key from step 2 and
   name it exactly `App Store Connect key`.
5. In the app's Codemagic settings → **Environment variables**, add `APP_STORE_APPLE_ID` with the number
   from step 1.
6. Start the **iPhone app → TestFlight** workflow. When it finishes, install **TestFlight** on your
   iPhone and the app appears there.
