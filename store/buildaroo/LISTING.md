# Buildaroo: App Store and Google Play package

Everything to type into App Store Connect (appstoreconnect.apple.com) and the Google Play
Console for Buildaroo, the city game. Screenshots and the preview video are in this folder
(see `SCREENSHOTS.md`). The age rating and privacy answers were checked against the code on
2026-11-26; see `../RATINGS-AND-PRIVACY.md` for the reasoning behind each answer.

The app is **iPhone only** (no iPad), so Apple needs only iPhone screenshots.

---

## 1. New app (App Store Connect → Apps → +)

| Field | Value |
|---|---|
| Platform | iOS |
| Name (30 max) | `Buildaroo: City Tycoon` (22). If taken: `Buildaroo: Build a City` |
| Primary language | English (U.S.) |
| Bundle ID | `com.bigbrucestudios.buildaroo` |
| SKU | `buildaroo-ios-1` |
| User access | Full access |

## 2. App information

- **Subtitle** (30 max): `Grow a town from one café` (25)
- **Category:** Games → primary **Simulation**, secondary **Casual**.
- **Content rights:** "No, it does not contain, show, or access third-party content."
- **Age rating:** answer exactly as in `../RATINGS-AND-PRIVACY.md` → Buildaroo. Expected
  result **4+**. (User-generated content is "Yes" because nicknames, city names and cities are
  visible to other players; that alone keeps 4+.)
- **Privacy policy URL:** `https://www.bigbrucestudios.com/privacy/` (the page is in
  `../site/privacy/`; it covers friends' cities, gifts and the city leaderboard).
- **Support URL:** `https://www.bigbrucestudios.com/support/`
- **Marketing URL:** `https://www.bigbrucestudios.com/`
- **Copyright:** `2027 Big Bruce Studios LLC`

## 3. Pricing and availability

- Price: **Free**. Availability: all countries.

## 4. App privacy ("Data collection: Yes")

Tracking: **No**. Declare these (the full reasoning is in `../RATINGS-AND-PRIVACY.md`):

| Apple data type | What it is in Buildaroo | Linked to user | Purpose |
|---|---|---|---|
| Identifiers → User ID | the random player id the game makes (not an Apple, device or ad id) | Yes | App Functionality |
| User Content → Gameplay Content | the cloud backup of the save, tower scores and tap timings | Yes | App Functionality |
| User Content → Other User Content | nickname, city name, the city snapshot friends visit, gifts | Yes | App Functionality |
| Purchases → Purchase History | which crystal packs were bought (kept in the backup so purchases survive a new phone) | Yes | App Functionality |
| Usage Data → Product Interaction | anonymous play statistics under a separate random id | No | Analytics |
| Diagnostics → Crash Data, Performance Data, Other Diagnostic Data | crash text, frame rate, phone model and graphics chip | No | App Functionality |

This replaces the earlier draft that marked everything "not linked": a game-made user id is
still an identifier in Apple's terms, so data filed under it counts as linked. Declaring it
linked is what Apple expects and doesn't change how the page looks to players beyond one
extra heading.

Purchases are handled by Apple. There is no tracking and no third-party SDK collecting
data. **If you later connect rewarded ads (AdMob)**, these answers change: see
`launch/ADS.md`.

## 5. In-app purchases (Features → In-App Purchases)

Consumables (the Product ID must match exactly):

| Reference name | Product ID | Price | Display name | Description (55 max) |
|---|---|---|---|---|
| 200 Sky Crystals | `crystals_200` | $1.99 | 200 Sky Crystals | A pouch of Sky Crystals |
| 1,250 Sky Crystals | `crystals_1250` | $10.99 | 1,250 Sky Crystals | 1,100 Sky Crystals + 14% bonus |
| 2,600 Sky Crystals | `crystals_2600` | $20.99 | 2,600 Sky Crystals | 2,100 Sky Crystals + 24% bonus |
| 8,000 Sky Crystals | `crystals_8000` | $59.99 | 8,000 Sky Crystals | 6,000 + 33% bonus and 7 days of VIP |
| 14,000 Sky Crystals | `crystals_14000` | $99.99 | 14,000 Sky Crystals | 10,000 + 40% bonus and 30 days of VIP |
| Starter Pack | `starter_pack` | $0.99 | Starter Pack | 300 crystals, Sunrise paint, a fountain |

(`crystals_650` is retired: don't create it.)

Auto-renewable subscription (Features → Subscriptions → group "VIP"):

| Reference name | Product ID | Price | Duration | Display name | Description |
|---|---|---|---|---|---|
| VIP monthly | `skyrise_vip_monthly` | $4.99 | 1 month | Buildaroo VIP | Daily crystals, an extra builder, faster builds |

For each product add a **review screenshot**: on the TestFlight build, open Shop → Crystals
and take one screenshot; reuse it for all of them. Then select them all on the version
page under **In-App Purchases and Subscriptions**. You must have accepted the **Paid Apps
Agreement** (Business → Agreements) with bank and tax details, or purchases won't load.

## 6. App Review information

- Sign-in required: **No**.
- Notes (paste):

> Buildaroo is a city-building tycoon. Tap the Coffee Cart to sell, buy levels, hire
> managers, and grow the city: homes, businesses, decorations and City Hall levels.
> In-app purchases are in Shop (bag icon, opens at City Hall level 2, about 10 minutes in)
> → Crystals: consumable packs of Sky Crystals, a one-time Starter Pack, and an optional
> monthly VIP subscription. Crystals buy time skips for builds, building paints,
> decorations and the Season Pass premium track. Nothing is random: players always see
> exactly what they get. No account is needed. Players can visit other players' cities
> from Me → Leaders and leave a gift; nicknames are filtered and can be reported.

## 7. Screenshots and preview

- **6.9" iPhone** (1290 × 2796): `app-store-6.9/1-town.png` … `6-hall.png`, in order.
- **6.3" iPhone** (1206 × 2622): `app-store-6.3/`, same order. Upload both; Apple scales
  them for the other iPhone sizes.
- **App preview video** (optional, 886 × 1920, 15–30 s): `preview-886x1920.mp4` in this
  folder when it's there (see the README).

---

## 8. Store text, five languages

Paste each block into the matching localization (App Store Connect → the version page →
the language menu at the top right). Google Play uses the same text: "Short description"
is the subtitle line below, "Full description" the description.

### English (U.S.)

- **Subtitle:** Grow a town from one café
- **Google Play short description (80 max):** Start with one coffee cart and grow a whole city in the sky!
- **Promotional text (170 max):** New: build with friends, send gifts, paint your buildings and win the Season Pass. Every season brings new decorations to your city!
- **Keywords (100 max):** `city,builder,tycoon,idle,town,build,business,simulation,cafe,decorate,mayor,village,islands,cozy`
- **Description:**

> Start with one little coffee cart. End with a whole city.
>
> GROW YOUR TOWN
> Sell coffee, buy levels and hire managers who earn while you're away. Open a bakery, a cinema, a flower shop and more, and watch each business grow from a cart into a landmark.
>
> BUILD IT YOUR WAY
> Build homes and watch people move in. Place parks, fountains, a ferris wheel, a lighthouse, a stadium and an airport. Paint your buildings in your own colours.
>
> LEVEL UP CITY HALL
> Every City Hall level opens new districts, new buildings and new surprises, from a quiet hamlet to a glittering metropolis.
>
> A CITY THAT LIVES
> Residents chat on the streets, buses and cars fill the roads at rush hour, a night market opens after dark and fireworks light up the weekend. Every season, spring blossom, summer festival, spooky town and winter lights, changes your whole city.
>
> PLAY WITH FRIENDS
> Visit friends' cities, leave them a gift, build together on a friend team, and climb the city leaderboard.
>
> Free to play. Optional purchases of Sky Crystals, a Starter Pack and a VIP subscription. You always see exactly what you get.

### Spanish (Mexico)

- **Subtitle:** Tu pueblo, desde un café
- **Google Play:** ¡Empieza con un carrito de café y crea toda una ciudad en el cielo!
- **Promotional text:** Novedad: construye con amigos, envía regalos, pinta tus edificios y gana el Pase de temporada. ¡Cada temporada trae nuevas decoraciones!
- **Keywords:** `ciudad,construir,tycoon,idle,pueblo,negocio,simulación,café,decorar,alcalde,islas,relajante`
- **Description:**

> Empieza con un carrito de café. Termina con toda una ciudad.
>
> HAZ CRECER TU PUEBLO
> Vende café, compra niveles y contrata gerentes que ganan mientras no estás. Abre una panadería, un cine, una florería y más, y mira cómo cada negocio pasa de carrito a monumento.
>
> CONSTRÚYELA A TU MANERA
> Construye casas y mira cómo llega gente nueva. Coloca parques, fuentes, una noria, un faro, un estadio y un aeropuerto. Pinta tus edificios con tus colores.
>
> SUBE DE NIVEL EL AYUNTAMIENTO
> Cada nivel abre nuevos distritos, edificios y sorpresas, de una aldea tranquila a una metrópolis brillante.
>
> UNA CIUDAD CON VIDA
> Los vecinos charlan en la calle, el tráfico crece en hora punta, un mercado nocturno abre al anochecer y los fuegos artificiales iluminan el fin de semana. Cada temporada transforma tu ciudad.
>
> JUEGA CON AMIGOS
> Visita las ciudades de tus amigos, déjales un regalo, construyan juntos en equipo y sube en la clasificación de ciudades.
>
> Gratis. Compras opcionales de cristales, un Pack de inicio y una suscripción VIP. Siempre ves exactamente lo que recibes.

### Portuguese (Brazil)

- **Subtitle:** Uma cidade a partir de um café
- **Google Play:** Comece com um carrinho de café e construa uma cidade inteira no céu!
- **Promotional text:** Novidade: construa com amigos, mande presentes, pinte seus prédios e ganhe o Passe da temporada. Cada temporada traz novas decorações!
- **Keywords:** `cidade,construir,tycoon,idle,vila,negócio,simulação,café,decorar,prefeito,ilhas,relaxante`
- **Description:**

> Comece com um carrinho de café. Termine com uma cidade inteira.
>
> FAÇA SUA CIDADE CRESCER
> Venda café, compre níveis e contrate gerentes que ganham enquanto você está fora. Abra uma padaria, um cinema, uma floricultura e mais, e veja cada negócio virar um marco da cidade.
>
> DO SEU JEITO
> Construa casas e veja gente nova chegar. Coloque parques, chafarizes, uma roda-gigante, um farol, um estádio e um aeroporto. Pinte os prédios com as suas cores.
>
> SUBA O NÍVEL DA PREFEITURA
> Cada nível abre novos distritos, prédios e surpresas, de uma vila tranquila a uma metrópole brilhante.
>
> UMA CIDADE VIVA
> Moradores conversam nas ruas, o trânsito aumenta na hora do rush, uma feira noturna abre ao anoitecer e fogos iluminam o fim de semana. Cada temporada transforma sua cidade.
>
> JOGUE COM AMIGOS
> Visite as cidades dos amigos, deixe presentes, construam juntos em time e suba no ranking de cidades.
>
> Grátis. Compras opcionais de cristais, um Pacote inicial e uma assinatura VIP. Você sempre vê exatamente o que recebe.

### French (France)

- **Subtitle:** Une ville à partir d'un café
- **Google Play:** Commence avec un petit chariot à café et bâtis toute une ville dans le ciel !
- **Promotional text:** Nouveau : construis avec tes amis, envoie des cadeaux, peins tes bâtiments et gagne le Pass de saison. Chaque saison apporte de nouvelles décorations !
- **Keywords:** `ville,construire,tycoon,idle,village,commerce,simulation,café,décorer,maire,îles,détente`
- **Description:**

> Commence avec un petit chariot à café. Termine avec toute une ville.
>
> FAIS GRANDIR TA VILLE
> Vends du café, achète des niveaux et engage des gérants qui gagnent même quand tu n'es pas là. Ouvre une boulangerie, un cinéma, un fleuriste et plus encore, et regarde chaque commerce devenir un monument.
>
> À TA FAÇON
> Construis des maisons et accueille de nouveaux habitants. Place des parcs, des fontaines, une grande roue, un phare, un stade et un aéroport. Peins tes bâtiments à tes couleurs.
>
> FAIS MONTER LA MAIRIE
> Chaque niveau ouvre de nouveaux quartiers, bâtiments et surprises, du hameau tranquille à la métropole scintillante.
>
> UNE VILLE VIVANTE
> Les habitants discutent dans la rue, la circulation grossit aux heures de pointe, un marché de nuit ouvre le soir et des feux d'artifice illuminent le week-end. Chaque saison transforme ta ville.
>
> JOUE AVEC TES AMIS
> Visite les villes de tes amis, laisse-leur un cadeau, construisez ensemble en équipe et grimpe au classement des villes.
>
> Gratuit. Achats facultatifs de cristaux, d'un Pack de départ et d'un abonnement VIP. Tu vois toujours exactement ce que tu reçois.

### German

- **Subtitle:** Vom Café zur ganzen Stadt
- **Google Play:** Starte mit einem Kaffeewagen und bau eine ganze Stadt im Himmel!
- **Promotional text:** Neu: mit Freunden bauen, Geschenke schicken, Gebäude anmalen und den Saisonpass gewinnen. Jede Saison bringt neue Dekos in deine Stadt!
- **Keywords:** `stadt,bauen,tycoon,idle,dorf,geschäft,simulation,café,dekorieren,bürgermeister,inseln,entspannt`
- **Description:**

> Starte mit einem kleinen Kaffeewagen. Ende mit einer ganzen Stadt.
>
> LASS DEINE STADT WACHSEN
> Verkaufe Kaffee, kaufe Stufen und stelle Manager ein, die verdienen, während du weg bist. Eröffne eine Bäckerei, ein Kino, einen Blumenladen und mehr, und sieh zu, wie jedes Geschäft vom Wagen zum Wahrzeichen wird.
>
> BAU SIE, WIE DU WILLST
> Baue Häuser und begrüße neue Bewohner. Stelle Parks, Brunnen, ein Riesenrad, einen Leuchtturm, ein Stadion und einen Flughafen auf. Mal deine Gebäude in deinen Farben an.
>
> BAU DAS RATHAUS AUS
> Jede Rathaus-Stufe öffnet neue Viertel, Gebäude und Überraschungen, vom ruhigen Weiler bis zur glitzernden Metropole.
>
> EINE STADT VOLLER LEBEN
> Bewohner plaudern auf der Straße, zur Rushhour wird es voll, abends öffnet ein Nachtmarkt und am Wochenende leuchtet Feuerwerk. Jede Saison verwandelt deine ganze Stadt.
>
> SPIEL MIT FREUNDEN
> Besuche die Städte deiner Freunde, lass ein Geschenk da, baut gemeinsam im Team und klettere in der Städte-Rangliste.
>
> Kostenlos. Optionale Käufe von Kristallen, einem Startpaket und einem VIP-Abo. Du siehst immer genau, was du bekommst.

---

## 9. What's new

App Store version 1.0 has no "What's New" field. Use these for Google Play's first release
notes and the first update.

- **Google Play 1.0 release notes (500 max):**
  `Welcome to Buildaroo! Start with one coffee cart, open ten businesses, level up City Hall and visit your friends' cities. Thanks for playing our first release.`
- **Template for later updates:** one line per change, players' words, the biggest first:
  `New: the Spring Blossom season with 12 decorations. Better: builds finish faster after City Hall level 5. Fixed: the shop no longer closes on small phones.`

## 10. Google Play

Play Console → Create app: name `Buildaroo: City Tycoon`, default language English (United
States), **Game**, **Free**. Package name comes from the first upload:
`com.bigbrucestudios.buildaroo`.

- **Store listing:** App name and descriptions from section 8 ("Google Play" line = short
  description, "Description" = full description). Phone screenshots: `google-play/` (1080 ×
  1920), in order. App icon: `play-icon-512.png`. Feature graphic: `feature-graphic.png`
  (1024 × 500). Video: optional YouTube link of `preview-886x1920.mp4` if you upload it.
- **Category:** Game → **Simulation**. Tags: City building, Tycoon, Idle, Casual.
- **Contact:** email `support@bigbrucestudios.com`, website `https://www.bigbrucestudios.com/`.
- **Privacy policy:** `https://www.bigbrucestudios.com/privacy/`
- **App access:** all functionality available without special access.
- **Ads:** No.
- **Content rating (IARC):** answers in `../RATINGS-AND-PRIVACY.md`. Expected: ESRB
  Everyone, PEGI 3, with "Users Interact" and "In-Game Purchases".
- **Target audience:** 13–15, 16–17, 18+ (see the note in `../RATINGS-AND-PRIVACY.md`).
- **Data safety:** answers in `../RATINGS-AND-PRIVACY.md`.
- **In-app products and subscription:** the same ids and prices as section 5, except the
  subscription id on Google Play is `vip_monthly` (base plan `monthly`, $4.99/month).
