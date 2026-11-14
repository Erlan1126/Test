# Rewarded ads (optional)

The game is ready for one kind of ad: after a tower, a player can choose to watch a short
ad to double the stars that tower earned (at most 5 a day). Nothing shows without a tap,
and there are no banners or pop-ups. Until an ad network is connected the button is
hidden, so players see nothing.

## What you do (your accounts)

1. Create an AdMob account at admob.google.com (free) with the Erlan Studios details.
2. In AdMob, add two apps: "Skyrise: Tower Stack" for Android (com.erlanstudios.skyrise)
   and for iOS.
3. In each app, create one **Rewarded** ad unit. Write down:
   - the Android App ID and Rewarded ad unit ID
   - the iOS App ID and Rewarded ad unit ID
4. Send those four IDs (they aren't secret) and I'll connect them.

## What changes when they're connected

- The AdMob plugin is added to both apps, with your App IDs in their settings.
- Before the first ad, players in the EU/UK see Google's consent message, and on iPhone
  the "Allow tracking?" question (both required).
- Store forms need updating: Google Play "Data safety" (advertising ID, device data
  shared with AdMob) and the App Store "App Privacy" answers (identifiers, usage data,
  used for third-party advertising).
- An `app-ads.txt` file goes on your website if you have one (AdMob shows its line).
