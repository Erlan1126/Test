// "How Skyhaven works": every word, number and button in the game, explained in one short
// line (the ? on the top bar, and Settings > How to play). Plain words a new player gets.

export interface GuideRow { icon: string; title: string; text: string; /** Only in the tower game. */ tower?: boolean; /** The city game's own words for it. */ city?: string; cityTitle?: string }
export interface GuideSection { title: string; rows: GuideRow[]; tower?: boolean; cityTitle?: string }

export const GUIDE: GuideSection[] = [
  {
    title: "Your goal",
    rows: [
      { icon: "crown", title: "Grow Skyhaven to the Sky Capital", text: "Start with one neighbor and a coffee cart. Grow your businesses and the town ranks up." },
      { icon: "map", title: "Town level (Lv)", text: "The bar at the top. Every rank adds something new to the town and +10% to every business." },
      { icon: "home", title: "Your neighbor", text: "The first person in your first tower. They react whenever the town grows.", city: "Your first resident. They react whenever the town grows." },
      { icon: "island", title: "The island next door", text: "At Big City, a floating island rises. Build a greenhouse or a lookout there." },
      { icon: "pointer", title: "Looking around", text: "Drag one finger to move around the town. Pinch with two fingers to zoom." },
      { icon: "home", title: "Grow your buildings", text: "Every home, block of flats and office in town is yours: tap one to see who lives there and what it pays. Upgrade it and it grows, from little homes up to a glass skyscraper, and every business earns more. A green ⬆ shows the ones you can grow now." },
      { icon: "target", title: "Districts for sale", text: "A green \"For sale\" bubble floats over a new island beside your town. Buy it with cash: a bridge joins it to the town, a whole district is built there, and every business earns 15% more." },
      { icon: "star", title: "Town scrapbook", text: "A real picture of your town at every new rank. Share Then → Now with a friend (Me > Scrapbook)." },
      { icon: "target", title: "A greyed-out button?", text: "Tap it anyway: the game tells you why, and how long until you can." },
    ],
  },
  {
    title: "Money",
    rows: [
      { icon: "bank", title: "Cash", text: "What your businesses earn. Tap it at the top to see exactly what each one makes." },
      { icon: "city", title: "Businesses", text: "Coffee Cart, Bakery, Cinema and more. Tap one in town to sell, buy levels, or hire help." },
      { icon: "star", title: "Business levels", text: "Each level makes a business earn more. All levels together raise your town level." },
      { icon: "bolt", title: "Speed milestones", text: "At 10, 25, 50, 100 levels and more, a business works twice as fast." },
      { icon: "building", title: "Office floors", text: "Every business level needs one. Each tower floor you build adds two.", tower: true },
      { icon: "medal", title: "Managers", text: "A manager sells for you all the time, even while the game is closed (up to 4 hours, 12 with VIP)." },
      { icon: "tower", title: "HQ", text: "When a business has enough levels, build its new headquarters as a tower to grow it.", city: "When a business has enough levels, the builders grow it into a bigger building: tap Grow it!" },
      { icon: "bolt", title: "Rush hour, VIPs and golden customers", text: "Short events in town. Tap them quickly for extra cash." },
      { icon: "bank", title: "Big numbers", text: "K is a thousand, M a million, B a billion, T a trillion. Qa, Qi and Sx are even bigger." },
    ],
  },
  {
    title: "Stars, crystals and gems", cityTitle: "Crystals, gems and passes",
    rows: [
      { icon: "star", title: "Stars (★)", text: "Earned by building towers and finishing goals. They buy decorations and tower boosters.", tower: true },
      { icon: "gem", title: "Sky Crystals (💎)", text: "The special currency for decorations, boosters and tower looks. Earn them from goals and the Sky Pass.", city: "The special currency: finish builds now, paints, decorations and the Season Pass. Earn them from goals, milestones and events." },
      { icon: "sparkle", title: "Sky Gems and New Era", text: "Later on, restart your businesses for Sky Gems. Each gem adds 2% to everything, for good. Gems are not crystals." },
      { icon: "gift", title: "Sky Pass", text: "A reward road: playing earns XP, and every tier gives a prize.", cityTitle: "Season Pass", city: "While a season is on, growing the city earns season points, and every step gives a prize. Premium adds more, with special paints." },
      { icon: "target", title: "Goals and Pip's chapters", text: "Daily goals give stars. Pip's chapter shows the steps to the next town rank.", city: "Three city quests a day pay cash. City Hall goals show the steps to its next level." },
    ],
  },
  {
    title: "Building towers",
    tower: true,
    rows: [
      { icon: "pointer", title: "Tap to drop", text: "Tap to drop the sliding floor. Whatever hangs over the edge breaks off." },
      { icon: "sparkle", title: "Perfect drops", text: "Line it up exactly: nothing breaks off, it pays more, and the tower grows wider again." },
      { icon: "fire", title: "Fever", text: "Eight perfect drops in a row: the next six floors count double." },
      { icon: "ice", title: "Special floors", text: "Gold pays more, ice slides fast, gardens widen your tower. Bubbles carry power-ups." },
      { icon: "city", title: "What a tower does", text: "Its people move into Skyhaven and its floors become offices for your businesses." },
    ],
  },
];

/** Skyrise's own guide: the tower game on its own, with no businesses, cash or mayor. */
export const TOWER_GUIDE: GuideSection[] = [
  {
    title: "Your goal",
    rows: [
      { icon: "crown", title: "Build the capital of the sky", text: "Every tower's people move into {city}. Grow it from a meadow to half a million people." },
      { icon: "target", title: "The Sky City plan", text: "Zephyr the swift guides you through six chapters of goals, on the strip on the home screen. Finish a chapter for stars and crystals." },
      { icon: "map", title: "Builder level (Lv)", text: "The badge at the top. Every tower earns XP, and new levels pay stars and open new things." },
      { icon: "island", title: "New islands", text: "More people open new islands: Snowy Peaks, Desert Oasis and Cherry Blossom. Pick one in the Shop and build there." },
      { icon: "building", title: "Your skyline", text: "Towers of 8 floors or more stand on their island for good. Your tallest one stands on the home island." },
      { icon: "home", title: "City buildings", text: "Spend stars in the Sky City on a café, a playground, a lighthouse and more. They stand on your island." },
      { icon: "target", title: "A greyed-out button?", text: "Tap it anyway: the game tells you why, and how long until you can." },
    ],
  },
  {
    title: "Building towers",
    rows: [
      ...GUIDE[3].rows.filter(r => r.title !== "What a tower does"),
      { icon: "city", title: "What a tower does", text: "Its people move into {city}, it earns stars and XP, and tall ones pass famous landmarks." },
    ],
  },
  {
    title: "Stars and crystals",
    rows: [
      { icon: "star", title: "Stars (★)", text: "Earned by building towers and finishing goals. They buy tower looks, boosters and city buildings." },
      { icon: "gem", title: "Sky Crystals (💎)", text: "The special currency for tower looks and boosters. Earn them from goals, chapters and the Sky Pass." },
      GUIDE[2].rows.find(r => r.icon === "gift")!,
      { icon: "target", title: "Daily goals", text: "Three goals a day, each paying stars. Finish all three to open the day's chest." },
    ],
  },
];

/** One line at the top of each menu page, the first times it's opened. */
export const PAGE_INTRO: Record<string, string> = {
  company: "Your businesses earn cash. Buy levels to earn more; a manager sells for you, even while you're away.",
  shop: "Skins, shapes and islands for your towers, and boosts for your next one. Crystals buy the special things.",
  goals: "The Sky City plan is your big goal. Daily goals give stars; the Sky Pass gives a prize at every tier.",
  me: "Your builder profile, the leaderboard of the best towers, your Sky City and settings.",
};
/** The city game's own page intros. */
export const PAGE_INTRO_CITY: Record<string, string> = {
  shop: "Decorations show up in your town and make every business earn more. Crystals buy the special things.",
  goals: "City Hall goals are your big goal. Three city quests a day pay cash; events and the Season Pass give prizes.",
  me: "Your profile, the city leaderboard, your scrapbook and settings.",
};
