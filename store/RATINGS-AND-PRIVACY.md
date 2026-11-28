# Age ratings and privacy answers, all three games

Every answer below was checked against the code on 2026-11-26 (Buildaroo and Skyrise:
branch `claude/skyrise-living-block` plus PRs #29 and #30; Lumen Rush: `main` plus PR #28, which added crash reports on 2026-11-28).
If a game changes in one of the ways listed under "Answers that would change", update the
store forms before submitting that version.

What each game sends over the network, from the code:

| | Buildaroo | Skyrise | Lumen Rush |
|---|---|---|---|
| Random player id (made by the game) | yes | yes | no |
| Nickname others can see | yes | yes | no |
| City name and city snapshot others can visit | yes | no | no |
| Gifts to friends, friend teams | yes | no | no |
| Tower scores and tap timings (leaderboard check) | yes (tower mode) | yes | no |
| Cloud backup of the save (incl. which packs were bought) | yes | yes | no |
| Challenge links | yes | yes | share link only, made on the phone |
| Anonymous play statistics (separate random id) | yes | yes | no |
| Crash and frame-rate reports (phone model, GPU) | yes | yes | crash reports only (error, game version, phone model and screen size, current screen/stage); can be turned off in Settings |
| Game Center scores and achievements (iPhone) | yes | yes | no |
| Ads, third-party analytics, tracking | none | none | none |
| Server | our Cloudflare Worker (`server/`) | same | the same Worker's `/diag` endpoint, for crash reports only (GitHub Pages hosts the web page) |

---

## 1. App Store age rating (App Store Connect → App Information → Age Rating)

Apple's current questionnaire has seven groups. Answer every game the same way except the
two rows marked.

| Question | Buildaroo | Skyrise | Lumen Rush | Why |
|---|---|---|---|---|
| **In-App Controls:** Parental Controls | No | No | No | none in the games |
| Age Assurance | No | No | No | no age checks |
| **Capabilities:** Unrestricted Web Access | No | No | No | links open only our own pages and store pages |
| **User-Generated Content** | **Yes** | **Yes** | No | nicknames (and Buildaroo city names and cities) are shown to other players; filtered and reportable |
| Social Media | No | No | No | no feed, posts, comments, following or messages; see note A |
| Messaging and Chat | No | No | No | there is no chat |
| Shared Location | No | No | No | |
| Advertising | No | No | No | the rewarded-ad button stays hidden until AdMob is connected |
| **Mature Themes:** Profanity or Crude Humor | None | None | None | |
| Horror/Fear Themes | None | None | None | Lumen Rush's "dark" is a light-versus-night theme, not horror |
| Alcohol, Tobacco, or Drug Use or References | None | None | None | Buildaroo's café sells coffee; no bars |
| Dating and Relationships | None | None | None | |
| **Medical or Wellness:** Medical or Treatment Information | None | None | None | |
| Health or Wellness Topics | None | None | None | |
| **Sexuality or Nudity:** all three | None | None | None | |
| **Violence:** Cartoon or Fantasy Violence | None | None | None | no one is hurt: floors fall off (Skyrise), hazards cost a heart and the figure turns to sparks (Lumen Rush) |
| Realistic Violence, Prolonged Graphic Violence | None | None | None | |
| Guns or Other Weapons | None | None | None | |
| **Chance-Based Activities:** Gambling | No | No | No | |
| Simulated Gambling | None | None | None | see note B |
| Contests | None | None | None | leaderboards give no prizes |
| Loot Boxes | No | No | No | nothing random is sold; see note B |

**Expected rating: 4+ for all three.** On Apple's scale, user-generated content on its own
stays 4+.

**Note A, Social Media.** Apple defines it as letting players redistribute, amplify or
interact with others' content through a feed or similar discovery. Buildaroo's city
leaderboard lists other players' cities and lets you visit one and leave a gift, which is
the closest any of the games comes. We answer No because there is nothing to post, no feed,
no comments, no follows and no messages: the only content is a filtered name. If App Review
disagrees, switching it to Yes makes Buildaroo **13+**; the fix that keeps 4+ would be to show
only friends' cities (by friend code) to under-13s, which the game can't tell apart today.

**Note B, chance.** Buildaroo has a free daily prize wheel (one spin a day, one more for a
rewarded ad when ads exist) paying in-game cash, crystals or build speed-ups. Skyrise's daily
mission chest and Lumen Rush's light capsules are also free. None can be bought with money or
crystals, and none looks like a casino game, so they're not loot boxes or simulated gambling
in Apple's terms. If a future version sells spins, chests or capsules (for money or crystals),
answer Loot Boxes **Yes** (9+, 16+ in Australia). Buildaroo's late business "Starlight Stage"
is a theatre, not a casino; keep it that way in art and text.

---

## 2. App Store privacy labels (App Store Connect → App Privacy)

### Buildaroo and Skyrise

"Do you or your third-party partners collect data from this app?" **Yes.**
"Is data used to track users?" **No**, for every type.

| Data type | Linked to the user | Purposes | What it is |
|---|---|---|---|
| Identifiers → **User ID** | Yes | App Functionality | the random player id the game makes |
| User Content → **Gameplay Content** | Yes | App Functionality | save backup, tower scores and tap timings |
| User Content → **Other User Content** | Yes | App Functionality | nickname; Buildaroo also city name, city snapshot, gifts; challenge links |
| Purchases → **Purchase History** | Yes | App Functionality | which packs were bought, kept in the backup and (web) the Stripe record |
| Usage Data → **Product Interaction** | No | Analytics | anonymous play statistics |
| Diagnostics → **Crash Data** | No | App Functionality | error text when the game crashes |
| Diagnostics → **Performance Data** | No | App Functionality | frames per second after each tower |
| Diagnostics → **Other Diagnostic Data** | No | App Functionality | app version, phone model, graphics chip |

Not collected: contact info, health, financial info (Apple and Google take payment), location,
sensitive info, contacts, browsing or search history, other identifiers (no device or ad id),
photos, audio, emails or texts.

Why "linked": Apple counts data stored under an id assigned to the user as linked to that
user, even when the id is random and there is no account. The statistics and crash reports
use a separate id (or none), so they stay "not linked". Earlier drafts in `launch/stores/`
marked everything "not linked"; use this table.

Crash reports were rechecked on 2026-11-28 (`src/diag.ts`, including the Sentry option PR #29
adds): they carry the error, app version, phone model and graphics chip, and no player id,
nickname or save, so Crash Data, Performance Data and Other Diagnostic Data stay **not linked**.
If Sentry is switched on for any of the three games, turn on **Prevent Storing of IP Addresses**
in that Sentry project's Security & Privacy settings, so the reports stay unlinked.

The iOS privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`, PR #30) declares only
required-reason APIs and no tracking domains, which matches.

### Lumen Rush

Since PR #28, Lumen Rush sends an anonymous crash report to our report server when the game
hits an error (`echo/diag.js`). It carries no player id or anything else that ties reports to a
person or to each other, so the label is "Data Not Linked to You", with nothing else.

"Do you or your third-party partners collect data from this app?" **Yes.**
"Is data used to track users?" **No.**

| Data type | Linked to the user | Purposes | What it is |
|---|---|---|---|
| Diagnostics → **Crash Data** | No | App Functionality | the error message and where in the code it happened |
| Diagnostics → **Other Diagnostic Data** | No | App Functionality | game version, phone model and screen size, and what the game was doing (for example "run · stage 12") |

Everything else: not collected. (If you'd rather keep "Data Not Collected", the only way is to
remove crash reporting from the store version; turning it off by default isn't enough.)

---

## 3. Google Play content rating (Policy → App content → Content rating, IARC)

Category: **Game**. Email for the certificate: `support@bigbrucestudios.com`.

| IARC question | Buildaroo | Skyrise | Lumen Rush |
|---|---|---|---|
| Violence (any kind, incl. cartoon) | No | No | No |
| Fear / horror | No | No | No |
| Sexuality, nudity | No | No | No |
| Gambling: real or simulated | No | No | No |
| Language (profanity, crude humour) | No | No | No |
| Controlled substances (alcohol, tobacco, drugs) | No | No | No |
| Does the app let users interact or exchange content? | **Yes** (players see each other's nicknames, city names and cities; no chat) | **Yes** (nicknames on leaderboards) | No |
| Does it share the user's location with others? | No | No | No |
| Can users buy digital goods? | **Yes** | **Yes** | No |
| Does it contain randomized items for purchase (loot boxes)? | No | No | No |
| Is it an unrestricted web browser or search engine? | No | No | No |

Expected: **ESRB Everyone, PEGI 3, USK 0**, with interactive elements "Users Interact" and
"In-Game Purchases" for Buildaroo and Skyrise, none for Lumen Rush.

## 4. Google Play target audience and "appeals to children"

- **Buildaroo and Skyrise:** target ages **13–15, 16–17, 18+**. "Could your store listing
  unintentionally appeal to children?" **No** is defensible (tycoon and arcade, no child
  characters), but the cartoon style means Google may ask. If Google puts either game under
  the Families policy, it already qualifies on ads and SDKs (none) but would need a neutral
  age screen before nicknames are shown; that's a code change to plan for only if asked.
- **Lumen Rush:** target **13+** as well, or add under-13 groups freely: with no ads,
  purchases or personal data, and crash reports that hold no identifiers, it meets the
  Families policy as it is.

## 5. Google Play Data safety (Policy → App content → Data safety)

### Buildaroo and Skyrise

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**, by email
  (deletion URL: `https://www.bigbrucestudios.com/support/#delete`)
- Shared with third parties: **No** for everything (Cloudflare only processes it for us, which
  Google doesn't count as sharing).

| Data type | Collected | Processed ephemerally | Required or optional | Purposes |
|---|---|---|---|---|
| Personal info → **Name** (the nickname) | Yes | No | Required (a default name is given) | App functionality |
| Personal info → **User IDs** (random player id) | Yes | No | Required | App functionality |
| Financial info → **Purchase history** | Yes | No | Required | App functionality |
| App activity → **App interactions** (anonymous statistics) | Yes | No | Required | Analytics |
| App activity → **Other user-generated content** (city name, city snapshot, gifts, challenge links) | Yes | No | Required | App functionality |
| App activity → **Other actions** (scores, tap timings, save backup) | Yes | No | Required | App functionality |
| App info and performance → **Crash logs** | Yes | No | Required | Analytics |
| App info and performance → **Diagnostics** (frame rate, phone model) | Yes | No | Required | Analytics |
| Device or other IDs (the statistics install id) | Yes | No | Required | Analytics |

For Skyrise, the "Other user-generated content" row covers nickname-bearing challenge
links only (no city).

### Lumen Rush

- Does your app collect or share any of the required user data types? **Yes** (crash reports).
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes**
  (`https://www.bigbrucestudios.com/support/#delete`). Reports hold nothing that identifies a
  player, and only the newest are kept.
- Shared with third parties: **No.**

| Data type | Collected | Processed ephemerally | Required or optional | Purposes |
|---|---|---|---|---|
| App info and performance → **Crash logs** | Yes | No | Optional (Settings → Send crash reports) | Analytics |
| App info and performance → **Diagnostics** (phone model, screen size, game version) | Yes | No | Optional | Analytics |

Nothing else. If Sentry is switched on later (`SENTRY_DSN` in `echo/diag.js`), the answers
stay the same, since Sentry only processes the reports for us.

---

## Answers that would change

| If this happens | Change |
|---|---|
| AdMob rewarded ads go live (`launch/ADS.md`) | Apple: Advertising Yes; Identifiers → Device ID, Usage/Product Interaction and Advertising Data for third-party advertising, Tracking **Yes** if personalized ads; Google: Ads Yes, Device or other IDs shared with Google. App Tracking Transparency prompt. Rating stays 4+ / Everyone. |
| A chat, comments or public posts are added | Messaging and Chat Yes (still 4+); Social Media likely Yes (**13+**). |
| Spins, chests or capsules can be bought | Loot Boxes Yes (**9+**, 16+ in Australia). |
| Lumen Rush gets purchases, leaderboards or analytics | redo all of its Lumen Rush rows; its privacy page section also changes. |
| Lumen Rush's crash reports start including a player id or save data | Crash Data and Other Diagnostic Data become **linked**. |
