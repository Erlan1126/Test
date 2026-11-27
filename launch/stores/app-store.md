# Skyrise: App Store Connect

Copy each part into the matching field in App Store Connect (appstoreconnect.apple.com).

## New app

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Skyrise: Tower Stack (30 characters max. If it's taken, try "Skyrise: Build the Sky") |
| Primary language | English (U.S.) |
| Bundle ID | com.bigbrucestudios.skyrise (register it first under Identifiers in the Apple Developer site) |
| SKU | skyrise-ios-1 |
| User access | Full access |

## App information

- **Subtitle** (30 max): `Grow a town above the clouds.`
- **Category:** Games. Subcategories: **Casual** and **Puzzle**.
- **Content rights:** "No, it does not contain, show, or access third-party content."
- **Age rating:** answer **None / No** to every question (no violence, no gambling, no
  user-generated content, no web browsing, no chat). The result should be **4+**.

## Pricing and availability

- Price: **Free**.
- Availability: all countries.

## App privacy

- Privacy policy URL: https://www.bigbrucestudios.com/privacy/
- Data collection: **"Yes, we collect data from this app"**, only for the worldwide
  leaderboard. Declare these three, each **Linked to the user: No**, **Used for tracking:
  No**, purpose **App Functionality**:
  - **Identifiers → User ID** (a random player id the game makes; not an Apple or device id)
  - **User Content → Other User Content** (the leaderboard nickname the player types)
  - **Usage Data → Product Interaction** (scores and the taps of ranked towers, to check them)
  Progress stays on the phone. Apple handles purchases. There are no ads or analytics.
  (If the leaderboard server isn't switched on yet, nothing is sent; you can still declare
  it now so you don't have to change the answers later.)

## Version 1.0 page

**Promotional text** (170 max, can change any time):

> One neighbor. One floating town. Stack towers, welcome residents and grow Skyhaven into the Capital of the Sky.

**Description:**

> Grow Skyhaven from one neighbor into the Capital of the Sky.
>
> Every tower you stack brings new people home. Start with a tiny floating neighborhood, welcome familiar faces, grow local businesses, and watch your town become a sky-high capital.
>
> STACK A TOWER, GROW A TOWN
> Time your tap as each floor slides across the sky. Perfect drops keep your tower wide; overhanging edges fall away. The people you bring home help Skyhaven grow.
>
> MAKE SKYHAVEN YOUR OWN
> Begin with a neighbor and a café. Build up your businesses, see your streets come alive, and unlock new landmarks as your town rises from Hamlet to Village, Town, City, Big City, Metropolis and finally Sky Capital.
>
> REACH FOR THE LANDMARKS
> Climb past famous sights, from the Statue of Liberty and Eiffel Tower to the Burj Khalifa. Discover special floors, including golden penthouses, icy floors and garden terraces.
>
> COME BACK TO A LIVING SKY
> Collect earnings, take on daily missions and a shared daily tower, and follow your progress through weekly leagues. Watch the sky change from morning to night with weather, lights and passing airships.
>
> PLAY AT YOUR PACE
> Chase a perfect stack in Classic, relax in Zen, or try landmark challenges. Personalize your towers and floating island with unlockable looks.
>
> Free to play, with no ads. Optional purchases offer Sky Crystals, cosmetics and business boosts. Crystal purchases show what you receive before you buy.

**Keywords** (100 max, commas, no spaces):

`tower,stack,building,skyscraper,tap,one tap,city,builder,block,casual,relaxing,arcade,timing,island`

(That's 99 characters. Don't repeat words already in the app name.)

- **Support URL:** your itch.io page, or any page with your contact email.
- **Marketing URL:** your itch.io page (optional).
- **Copyright:** `2026 Big Bruce Studios LLC`

## Five screenshot captions (English)

Use these in sequence on both stores when the screenshot artwork is next regenerated. These are copy specifications; the existing PNGs are not changed in this PR.

1. **ONE NEIGHBOR. A WHOLE SKY TO GROW.** — Start a home in Skyhaven.
2. **STACK TOWERS. WELCOME NEW PEOPLE.** — Every floor helps your town grow.
3. **WATCH YOUR NEIGHBORHOOD COME ALIVE.** — Grow businesses and unlock landmarks.
4. **FROM HAMLET TO SKY CAPITAL.** — Seven ranks. One town to call home.
5. **YOUR CAPITAL ABOVE THE CLOUDS.** — Make the floating skyline your own.

**Screenshots:** upload the seven files in `app-store-screenshots/` (1290 × 2796) to the
**6.9" / 6.7" iPhone** slot, in order 1 to 6. Apple scales them for smaller iPhones.
The app is iPhone only, so no iPad screenshots are needed.

**App icon:** taken from the build automatically.

## In-app purchases

Features → **In-App Purchases** → +. Make each one **Consumable** (players can buy
packs again and again). The Product ID must match exactly, because the game looks for these ids.

| Reference name | Product ID | Price | Display name | Description (55 max) |
|---|---|---|---|---|
| 200 Sky Crystals | crystals_200 | $1.99 | 200 Sky Crystals | A pouch of Sky Crystals |
| 650 Sky Crystals | crystals_650 | $5.99 | 650 Sky Crystals | 600 Sky Crystals + 8% bonus |
| 1,250 Sky Crystals | crystals_1250 | $10.99 | 1,250 Sky Crystals | 1,100 Sky Crystals + 14% bonus |
| 2,600 Sky Crystals | crystals_2600 | $20.99 | 2,600 Sky Crystals | 2,100 Sky Crystals + 24% bonus |
| 8,000 Sky Crystals | crystals_8000 | $59.99 | 8,000 Sky Crystals | 6,000 Sky Crystals + 33% bonus |
| 14,000 Sky Crystals | crystals_14000 | $99.99 | 14,000 Sky Crystals | 10,000 Sky Crystals + 40% bonus |

Everything else (premium skins and islands, the Sky Pass premium track) is bought **with
Sky Crystals inside the game**, so it doesn't need its own store product.

For each pack, also add a **review screenshot**: take one of Shop → 💎 Crystals on your
iPhone (TestFlight build) and reuse it for all six. Then, on the version page, select
all six under **In-App Purchases and Subscriptions** so they're reviewed with the app.

Before any of this works you must accept the **Paid Apps Agreement** and add your bank
and tax details (Business → Agreements). Without it, purchases won't load.

## App Review information

- Sign-in required: **No**.
- Notes:

> Skyrise is a one-tap tower stacking game. Tap anywhere to drop the sliding floor.
> In-app purchases are packs of Sky Crystals (consumable), in Shop → 💎 Crystals. The
> shop appears after the first 3 towers (one tower takes under a minute); then tap the
> bag icon at the bottom of the home screen. Crystals buy: cosmetic tower skins, islands
> and shapes; the monthly Sky Pass premium track; and boosts for the Skyhaven Inc.
> business mode (a permanent x2 cash booster, time warps that add hours of earnings,
> doubling what businesses earned while away, and hiring a chosen advisor whose perk is
> shown first). Nothing bought with crystals is random: players always see exactly what
> they get. (Finishing a day's free goals gives a random advisor the player doesn't own;
> it costs nothing.) Paid items never change tower scores, except that VIP includes one
> free rewind a day. No account is needed. The worldwide leaderboard (Ranks button)
> shows a nickname the player chooses.

## Spanish (Mexico) localization

The game switches to Spanish automatically on iPhones set to any Spanish language, so the
store page should too. In App Store Connect, open the app → the language menu at the top
right of **App Information** → add **Spanish (Mexico)** (and, if you like, **Spanish
(Spain)** with the same text). Then fill these fields for that language, on both the App
Information page and the version page. Everything else (screenshots, review notes, prices)
is shared with English unless you change it.

| Field | Value |
|---|---|
| Name (30 max) | Skyrise: Construye Torres |
| Subtitle (30 max) | `Apila pisos. Toca el cielo.` |

**Promotional text** (170 max):

> Nuevo: misiones diarias, racha de juego y ligas semanales. ¿Qué tan alto puedes construir?

**Description:**

> Construye el rascacielos más alto del mundo, un toque a la vez.
>
> Un piso se desliza de un lado a otro sobre tu torre. Toca para soltarlo. Lo que
> sobresale del borde se cae, así que cada error hace tu torre más angosta. Colócalo
> perfecto y el piso conserva todo su ancho, y en pisos más anchos cabe más gente.
>
> SUPERA MONUMENTOS REALES
> Las Cataratas del Niágara, la Estatua de la Libertad, la Gran Pirámide, la Torre Eiffel,
> el Empire State y el Burj Khalifa. El siguiente aparece junto a tu torre mientras subes.
>
> PISOS ESPECIALES
> Los penthouses dorados pagan 5x si los colocas perfecto. Los pisos de hielo se deslizan
> rápido pero caben más personas. Las terrazas jardín van lento y vuelven a ensanchar tu torre.
>
> ALGO NUEVO CADA DÍA
> Una torre diaria igual para todos, tres misiones y un cofre de premios, una racha de
> juego con protectores para los días libres, renta de tu torre y una liga semanal de
> Bronce a Leyenda. Activa el recordatorio diario para no perder nunca tu racha.
>
> TU PROPIA ISLA FLOTANTE
> Casas, una granja, un lago y una cascada, y una ciudad que construyes con estrellas: un
> café, un molino, un faro, una plataforma de cohetes y más.
>
> UN CIELO QUE CAMBIA MIENTRAS SUBES
> El día se vuelve atardecer y noche, con ventanas encendidas, luciérnagas, auroras,
> lluvia, nieve y relámpagos. Aviones, dirigibles y satélites pasan a su propia altura.
>
> JUEGA A TU MANERA
> Clásico, Diaria, un modo Zen relajante en el que no puedes perder, y seis desafíos de
> monumentos. Decenas de aspectos de torre, islas, trofeos y niveles de constructor.
>
> Gratis y sin anuncios. Los aspectos e islas premium son opcionales, solo cambian cómo
> se ve el juego y nunca te ayudan a puntuar.

**Keywords** (100 max, commas, no spaces after commas):

`torre,apilar,edificio,rascacielos,construir,ciudad,bloques,casual,relajante,arcade,isla,un toque`

(That's 96 characters.)

**In-app purchases:** open each pack → **App Store Localization** → add Spanish (Mexico):

| Product ID | Display name | Description (55 max) |
|---|---|---|
| crystals_200 | 200 Cristales Celestes | Una bolsa de Cristales Celestes |
| crystals_650 | 650 Cristales Celestes | 600 Cristales Celestes + 8% extra |
| crystals_1250 | 1,250 Cristales Celestes | 1,100 Cristales Celestes + 14% extra |
| crystals_2600 | 2,600 Cristales Celestes | 2,100 Cristales Celestes + 24% extra |
| crystals_8000 | 8,000 Cristales Celestes | 6,000 Cristales Celestes + 33% extra |
| crystals_14000 | 14,000 Cristales Celestes | 10,000 Cristales Celestes + 40% extra |

The privacy policy URL is shared across languages; a Spanish copy is in `../privacy-es.md`
if you want to publish it as well.

## Subscription (VIP)

Monetization → **Subscriptions** (not In-App Purchases) → group **Skyrise VIP** → +.
Product ID **skyrise_vip_monthly** (the App Store id; Google Play uses vip_monthly),
duration 1 Month, $4.99, billing grace period 3 days.
