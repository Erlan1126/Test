# Skyrise: App Store and Google Play package

Everything to type into App Store Connect and the Google Play Console for Skyrise, the
tower-stacking game (`npm run build:skyrise`). It replaces the older Skyrise files in
`launch/stores/` (`app-store.md`, `google-play.md`, `google-play-es.md`), which described
Skyrise when it still had Buildaroo's business city.

The game text matches the Skyrise build after PR #29 (tower story with Mayor Pip, no city
business screens). Age rating and privacy answers: `../RATINGS-AND-PRIVACY.md`.

**App ids (confirmed 2026-11-26 by the Skyrise app-split work, branch `skyrise-app`):**

- **iPhone:** `com.erlanstudios.skyrise`, the existing Skyrise app in App Store Connect,
  which already has TestFlight builds and a Codemagic signing profile. Use that app record;
  don't create a new one.
- **Android:** `com.bigbrucestudios.skyrise`.

**App Store product ids.** Apple product ids are unique across the whole developer account,
so Buildaroo and Skyrise can't both use `crystals_200`. The Skyrise build asks the App Store
for `skyrise.`-prefixed ids (`src/data/storeids.ts`, PR #33). Google Play ids are per app,
so Android keeps the plain ids. If the existing Skyrise App Store app already has products
with the plain ids, tell Claude: then Skyrise keeps the plain ids and Buildaroo takes the
prefix instead.

---

## 1. New app

| Field | Value |
|---|---|
| Name (30 max) | `Skyrise: Tower Stack` (20). If taken: `Skyrise: Build the Sky` |
| Primary language | English (U.S.) |
| Bundle ID | iPhone `com.erlanstudios.skyrise` (existing app record) · Android `com.bigbrucestudios.skyrise` |
| SKU | already set on the existing app record |
| Platform | iPhone only (no iPad), like Buildaroo |

## 2. App information

- **Subtitle** (30 max): `Stack floors. Touch the sky.` (28)
- **Category:** Games → primary **Casual**, secondary **Arcade**.
- **Content rights:** "No, it does not contain, show, or access third-party content."
  (Landmarks are named for height comparison only; the models are our own.)
- **Age rating:** `../RATINGS-AND-PRIVACY.md` → Skyrise. Expected **4+**.
- **Privacy policy URL:** `https://www.bigbrucestudios.com/privacy/`
- **Support URL:** `https://www.bigbrucestudios.com/support/`
- **Marketing URL:** `https://www.bigbrucestudios.com/`
- **Copyright:** `2027 Big Bruce Studios LLC`
- **Price:** Free, all countries.

## 3. App privacy

Same answers as Buildaroo, from `../RATINGS-AND-PRIVACY.md` (User ID, Gameplay Content,
Other User Content, Purchase History linked; Product Interaction and Diagnostics not linked;
no tracking).

## 4. In-app purchases

Consumables (App Store ids carry the `skyrise.` prefix; Google Play uses the id after it):

| Reference name | App Store id | Google Play id | Price | Display name | Description (55 max) |
|---|---|---|---|---|---|
| 200 Sky Crystals | `skyrise.crystals_200` | `crystals_200` | $1.99 | 200 Sky Crystals | A pouch of Sky Crystals |
| 1,250 Sky Crystals | `skyrise.crystals_1250` | `crystals_1250` | $10.99 | 1,250 Sky Crystals | 1,100 Sky Crystals + 14% bonus |
| 2,600 Sky Crystals | `skyrise.crystals_2600` | `crystals_2600` | $20.99 | 2,600 Sky Crystals | 2,100 Sky Crystals + 24% bonus |
| 8,000 Sky Crystals | `skyrise.crystals_8000` | `crystals_8000` | $59.99 | 8,000 Sky Crystals | 6,000 + 33% bonus and 7 days of VIP |
| 14,000 Sky Crystals | `skyrise.crystals_14000` | `crystals_14000` | $99.99 | 14,000 Sky Crystals | 10,000 + 40%, Diamond Skyline skin, 30 days VIP |
| Starter Pack | `skyrise.starter_pack` | `starter_pack` | $0.99 | Starter Pack | 300 crystals, the Sunrise skin and boosts |

(`crystals_650` is retired: don't create it.)

Subscription, group "Skyrise VIP": App Store `skyrise.vip_monthly`, Google Play `vip_monthly`
(base plan `monthly`), $4.99 / 1 month. Display name `Skyrise VIP`, description
`50 crystals and a free rewind daily, plus Platinum` (50).

Skins, islands, shapes and the Sky Pass premium track are bought with crystals inside the
game and need no store product. Add one review screenshot (Shop → Crystals) to each product.

## 5. App Review notes (paste)

> Skyrise is a one-tap tower stacking game. Tap anywhere to drop the sliding floor; overhangs
> fall off, perfect drops keep the tower wide. No account or sign-in is needed.
> In-app purchases are in Shop → Crystals (the Shop opens at builder level 3, after about
> three towers): consumable Sky Crystal packs, a one-time Starter Pack, and an optional monthly
> VIP subscription. Crystals buy cosmetic tower skins, islands and shapes and the Sky Pass
> premium track. Nothing bought is random, and paid items never change scores, except that VIP
> includes one free rewind a day. The worldwide leaderboard shows a nickname the player
> chooses; names are filtered and can be reported. Restore purchases is in Settings.

## 6. Screenshots and preview

- **6.9" iPhone** (1320 × 2868): `app-store-6.9/1-tap-to-drop.png` … `6-journey.png`, in order.
- **6.3" iPhone** (1206 × 2622): `app-store-6.3/`, same order.
- **Google Play phone** (1080 × 1920): `google-play/`, same order.
- **Google Play feature graphic** (1024 × 500): `feature-graphic.png`. **Icon** (512 × 512):
  `play-icon-512.png`.
- **App preview video** (optional): `app-preview-886x1920.mp4` is from November 14 and
  still shows the old home screen. Record a new one before using it, or leave it out.

Captions (English, as on the images). Shots 1 and 2 reuse the in-game frames of the
November 14 set (the tower screen hasn't changed); 3 to 6 are fresh captures of the PR #29
Skyrise build.

| # | Caption | Subline |
|---|---|---|
| 1 | Tap to drop. Stack to the sky. | Perfect drops keep your tower wide |
| 2 | Race past real landmarks | From Big Ben to the Burj Khalifa |
| 3 | Grow your sky city | Every tower brings new people home |
| 4 | Mayor Pip's tower story | Six chapters, from meadow to capital |
| 5 | 53 tower skins to collect | Glass, neon, candy, crystal and more |
| 6 | A journey to the clouds | 60 stages from Downtown to Cloud City |

---

## 7. Store text

Google Play uses the same text: the "Google Play" line is the short description (80 max),
the description is the full description.

### English (U.S.)

- **Subtitle:** Stack floors. Touch the sky.
- **Google Play short description:** Tap to drop each floor, stack the tallest tower and race past real landmarks!
- **Promotional text (170 max):** Mayor Pip needs a skyline! Stack towers, welcome new people to Skyhaven and climb past the Eiffel Tower, Taipei 101 and the Burj Khalifa.
- **Keywords (100 max):** `tower,stack,stacker,skyscraper,building,tap,timing,arcade,casual,blocks,landmarks,city,zen,relaxing`
- **Description:**

> Build the tallest skyscraper in the world, one tap at a time.
>
> TAP TO DROP
> Each floor slides across the sky. Tap to drop it. Whatever hangs over the edge falls away, so every miss makes your tower narrower. Land it perfectly and the floor keeps its full width, and wider floors fit more people.
>
> RACE PAST REAL LANDMARKS
> Climb past 18 famous sights, from Big Ben and the Statue of Liberty to the Eiffel Tower, Taipei 101 and the Burj Khalifa. The next one waits beside your tower as you rise.
>
> SPECIAL FLOORS
> Golden penthouses pay five times as much when you place them perfectly. Icy floors slide fast but hold more people. Garden terraces drift slowly and widen your tower again.
>
> GROW SKYHAVEN
> Every tower brings new people home to your floating city. Follow Mayor Pip's story through six chapters, from a quiet meadow to the capital of the sky, and unlock new islands: snowy peaks, a desert oasis, cherry blossoms, a volcano and a candy island.
>
> SOMETHING NEW EVERY DAY
> A daily tower that's the same for everyone, three missions with a reward chest, a daily gift streak, weekly events and a monthly Sky Pass.
>
> PLAY YOUR WAY
> Chase a perfect stack in Classic, take on 60 stages of the Skyline Journey, or relax in Zen, where you can't lose. Collect 53 tower skins, shapes and island looks, and climb the worldwide leaderboard.
>
> Free to play, with no ads. Optional purchases of Sky Crystals, a Starter Pack and a VIP subscription. You always see exactly what you get, and nothing you buy helps you score.

### Spanish (Mexico)

- **Name:** Skyrise: Torre al Cielo
- **Subtitle:** Apila pisos. Toca el cielo.
- **Google Play:** ¡Toca para soltar cada piso, construye la torre más alta y supera monumentos!
- **Promotional text:** ¡El alcalde Pip necesita un horizonte! Apila torres, da la bienvenida a gente nueva en Skyhaven y supera la Torre Eiffel, Taipei 101 y el Burj Khalifa.
- **Keywords:** `torre,apilar,rascacielos,edificio,construir,tocar,arcade,casual,bloques,monumentos,ciudad,zen`
- **Description:**

> Construye el rascacielos más alto del mundo, un toque a la vez.
>
> TOCA PARA SOLTAR
> Cada piso se desliza por el cielo. Toca para soltarlo. Lo que sobresale se cae, así que cada error hace tu torre más angosta. Colócalo perfecto y conserva todo su ancho; en pisos más anchos cabe más gente.
>
> SUPERA MONUMENTOS REALES
> Sube más allá de 18 lugares famosos, del Big Ben y la Estatua de la Libertad a la Torre Eiffel, Taipei 101 y el Burj Khalifa.
>
> PISOS ESPECIALES
> Los penthouses dorados pagan cinco veces más si los colocas perfecto. Los pisos de hielo se deslizan rápido pero caben más personas. Las terrazas jardín van lento y vuelven a ensanchar tu torre.
>
> HAZ CRECER SKYHAVEN
> Cada torre trae gente nueva a tu ciudad flotante. Sigue la historia del alcalde Pip en seis capítulos, de un prado tranquilo a la capital del cielo, y desbloquea islas nuevas: montañas nevadas, un oasis, cerezos en flor, un volcán y una isla de dulces.
>
> ALGO NUEVO CADA DÍA
> Una torre diaria igual para todos, tres misiones con cofre de premios, una racha de regalos diarios, eventos semanales y un Pase del cielo cada mes.
>
> JUEGA A TU MANERA
> Clásico, los 60 niveles del Viaje por el horizonte o el modo Zen, en el que no puedes perder. Colecciona 53 aspectos de torre, formas e islas, y sube en la clasificación mundial.
>
> Gratis y sin anuncios. Compras opcionales de Cristales celestes, un Pack de inicio y una suscripción VIP. Siempre ves exactamente lo que recibes, y nada de lo que compras te ayuda a puntuar.

### Portuguese (Brazil)

- **Name:** Skyrise: Torre ao Céu
- **Subtitle:** Empilhe andares até o céu
- **Google Play:** Toque para soltar cada andar, empilhe a torre mais alta e passe de monumentos!
- **Promotional text:** O prefeito Pip precisa de um horizonte! Empilhe torres, receba gente nova em Skyhaven e passe da Torre Eiffel, do Taipei 101 e do Burj Khalifa.
- **Keywords:** `torre,empilhar,arranha-céu,prédio,construir,tocar,arcade,casual,blocos,monumentos,cidade,zen`
- **Description:**

> Construa o arranha-céu mais alto do mundo, um toque de cada vez.
>
> TOQUE PARA SOLTAR
> Cada andar desliza pelo céu. Toque para soltá-lo. O que passar da borda cai, então cada erro deixa sua torre mais estreita. Encaixe perfeito e o andar mantém toda a largura, e andares mais largos cabem mais gente.
>
> PASSE DE MONUMENTOS REAIS
> Suba além de 18 lugares famosos, do Big Ben e da Estátua da Liberdade à Torre Eiffel, ao Taipei 101 e ao Burj Khalifa.
>
> ANDARES ESPECIAIS
> Coberturas douradas pagam cinco vezes mais quando encaixadas com perfeição. Andares de gelo deslizam rápido, mas cabem mais pessoas. Terraços-jardim vão devagar e alargam sua torre de novo.
>
> FAÇA SKYHAVEN CRESCER
> Cada torre traz gente nova para sua cidade flutuante. Siga a história do prefeito Pip em seis capítulos, de um campo tranquilo à capital do céu, e desbloqueie novas ilhas: picos nevados, um oásis, cerejeiras, um vulcão e uma ilha de doces.
>
> ALGO NOVO TODO DIA
> Uma torre diária igual para todos, três missões com baú de prêmios, uma sequência de presentes diários, eventos semanais e um Passe do céu todo mês.
>
> JOGUE DO SEU JEITO
> Clássico, as 60 fases da Jornada do horizonte ou o modo Zen, em que você não perde. Colecione 53 visuais de torre, formas e ilhas, e suba no ranking mundial.
>
> Grátis e sem anúncios. Compras opcionais de Cristais celestes, um Pacote inicial e uma assinatura VIP. Você sempre vê exatamente o que recebe, e nada que você compra ajuda na pontuação.

### French (France)

- **Name:** Skyrise : Tour vers le ciel
- **Subtitle:** Empile les étages, vise haut
- **Google Play:** Lâche chaque étage au bon moment et bâtis la plus haute tour du monde !
- **Promotional text:** Le maire Pip veut une skyline ! Empile des tours, accueille de nouveaux habitants à Skyhaven et dépasse la tour Eiffel, Taipei 101 et le Burj Khalifa.
- **Keywords:** `tour,empiler,gratte-ciel,immeuble,construire,toucher,arcade,casual,blocs,monuments,ville,zen,détente`
- **Description:**

> Construis le plus haut gratte-ciel du monde, une touche à la fois.
>
> TOUCHE POUR LÂCHER
> Chaque étage glisse dans le ciel. Touche pour le lâcher. Ce qui dépasse tombe, alors chaque erreur rend ta tour plus étroite. Pose-le parfaitement et il garde toute sa largeur, et plus un étage est large, plus il accueille de monde.
>
> DÉPASSE DE VRAIS MONUMENTS
> Grimpe au-delà de 18 lieux célèbres, de Big Ben et la statue de la Liberté à la tour Eiffel, Taipei 101 et le Burj Khalifa.
>
> ÉTAGES SPÉCIAUX
> Les penthouses dorés rapportent cinq fois plus s'ils sont posés parfaitement. Les étages de glace glissent vite mais accueillent plus de monde. Les terrasses jardin avancent lentement et élargissent à nouveau ta tour.
>
> FAIS GRANDIR SKYHAVEN
> Chaque tour amène de nouveaux habitants dans ta ville flottante. Suis l'histoire du maire Pip en six chapitres, d'une prairie tranquille à la capitale du ciel, et débloque de nouvelles îles : sommets enneigés, oasis, cerisiers en fleurs, volcan et île en bonbons.
>
> DU NOUVEAU CHAQUE JOUR
> Une tour du jour identique pour tous, trois missions avec un coffre, une série de cadeaux quotidiens, des événements chaque semaine et un Pass du ciel chaque mois.
>
> JOUE À TA FAÇON
> Classique, les 60 étapes du Voyage dans le ciel, ou le mode Zen où l'on ne perd jamais. Collectionne 53 apparences de tour, des formes et des îles, et grimpe au classement mondial.
>
> Gratuit et sans publicité. Achats facultatifs de Cristaux célestes, d'un Pack de départ et d'un abonnement VIP. Tu vois toujours exactement ce que tu reçois, et rien de ce que tu achètes n'aide à marquer des points.

### German

- **Name:** Skyrise: Turm in den Himmel
- **Subtitle:** Stapeln bis in den Himmel
- **Google Play:** Tippe, um jedes Stockwerk fallen zu lassen, und baue den höchsten Turm der Welt!
- **Promotional text:** Bürgermeister Pip braucht eine Skyline! Stapel Türme, begrüße neue Bewohner in Skyhaven und zieh am Eiffelturm, Taipei 101 und Burj Khalifa vorbei.
- **Keywords:** `turm,stapeln,wolkenkratzer,hochhaus,bauen,tippen,arcade,casual,blöcke,wahrzeichen,stadt,zen`
- **Description:**

> Bau den höchsten Wolkenkratzer der Welt, ein Tippen nach dem anderen.
>
> TIPPEN UND FALLEN LASSEN
> Jedes Stockwerk gleitet über den Himmel. Tippe, um es fallen zu lassen. Was über den Rand ragt, fällt ab, also macht jeder Fehler deinen Turm schmaler. Triffst du perfekt, behält das Stockwerk seine volle Breite, und auf breiteren Etagen wohnen mehr Menschen.
>
> ECHTE WAHRZEICHEN ÜBERHOLEN
> Klettere an 18 berühmten Bauwerken vorbei, von Big Ben und der Freiheitsstatue bis zum Eiffelturm, Taipei 101 und Burj Khalifa.
>
> BESONDERE STOCKWERKE
> Goldene Penthäuser bringen das Fünffache, wenn du sie perfekt setzt. Eisetagen gleiten schnell, fassen aber mehr Menschen. Gartenterrassen sind langsam und machen deinen Turm wieder breiter.
>
> LASS SKYHAVEN WACHSEN
> Jeder Turm bringt neue Bewohner in deine schwebende Stadt. Folge Bürgermeister Pips Geschichte durch sechs Kapitel, von der stillen Wiese bis zur Hauptstadt des Himmels, und schalte neue Inseln frei: Schneegipfel, eine Oase, Kirschblüten, einen Vulkan und eine Süßigkeiteninsel.
>
> JEDEN TAG ETWAS NEUES
> Ein Tagesturm, der für alle gleich ist, drei Missionen mit Belohnungstruhe, eine tägliche Geschenkserie, wöchentliche Events und jeden Monat ein Himmelspass.
>
> SPIEL, WIE DU WILLST
> Klassisch, die 60 Etappen der Skyline-Reise oder der Zen-Modus, in dem du nicht verlieren kannst. Sammle 53 Turm-Designs, Formen und Inseln und klettere in der weltweiten Rangliste.
>
> Kostenlos und ohne Werbung. Optionale Käufe von Himmelskristallen, einem Startpaket und einem VIP-Abo. Du siehst immer genau, was du bekommst, und nichts davon hilft dir beim Punkten.

---

## 8. What's new

- **Google Play 1.0 release notes:** `Welcome to Skyrise! Tap to drop, stack to the sky and follow Mayor Pip's story from a quiet meadow to the capital of the sky. Thanks for playing our first release.`
- **Later updates:** one line per change, biggest first, in players' words.

## 9. Google Play setup

- **Create app:** name `Skyrise: Tower Stack`, English (United States), Game, Free.
- **Category:** Game → **Casual**. Tags: Stacking, Arcade, Building, Offline.
- **Contact:** `support@bigbrucestudios.com`, website `https://www.bigbrucestudios.com/`.
- **Ads:** No. **App access:** everything available without special access.
- **Content rating, target audience, data safety:** `../RATINGS-AND-PRIVACY.md` → Skyrise.
- **Products:** section 4, Google Play ids.
- **Closed test:** new personal accounts need 12 testers for 14 days before production
  (organization accounts are exempt; see `STORES.md`).
