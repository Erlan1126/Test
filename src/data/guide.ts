// "How Skyhaven works": every word, number and button in the game, explained in one short
// line (the ? on the top bar, and Settings > How to play). Plain words a new player gets.

export interface GuideRow { icon: string; title: string; text: string }
export interface GuideSection { title: string; rows: GuideRow[] }

export const GUIDE: GuideSection[] = [
  {
    title: "Your goal",
    rows: [
      { icon: "crown", title: "Grow Skyhaven to the Sky Capital", text: "Start with one neighbor and a coffee cart. Grow your businesses and the town ranks up." },
      { icon: "map", title: "Town level (Lv)", text: "The bar at the top. Every rank adds something new to the town and +10% to every business." },
      { icon: "home", title: "Your neighbor", text: "The first person in your first tower. They react whenever the town grows." },
      { icon: "island", title: "The island next door", text: "At Big City, a floating island rises. Build a greenhouse or a lookout there." },
      { icon: "pointer", title: "Looking around", text: "Drag one finger to move around the town. Pinch with two fingers to zoom." },
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
      { icon: "building", title: "Office floors", text: "Every business level needs one. Each tower floor you build adds two." },
      { icon: "medal", title: "Managers", text: "A manager sells for you all the time, even while the game is closed (up to 8 hours, 24 with VIP)." },
      { icon: "tower", title: "HQ", text: "When a business has enough levels, build its new headquarters as a tower to grow it." },
      { icon: "bolt", title: "Rush hour, VIPs and golden customers", text: "Short events in town. Tap them quickly for extra cash." },
      { icon: "bank", title: "Big numbers", text: "K is a thousand, M a million, B a billion, T a trillion. Qa, Qi and Sx are even bigger." },
    ],
  },
  {
    title: "Stars, crystals and gems",
    rows: [
      { icon: "star", title: "Stars (★)", text: "Earned by building towers and finishing goals. They buy decorations and tower boosters." },
      { icon: "gem", title: "Sky Crystals (💎)", text: "The special currency for decorations, boosters and tower looks. Earn them from goals and the Sky Pass." },
      { icon: "sparkle", title: "Sky Gems and New Era", text: "Later on, restart your businesses for Sky Gems. Each gem adds 2% to everything, for good. Gems are not crystals." },
      { icon: "gift", title: "Sky Pass", text: "A reward road: playing earns XP, and every tier gives a prize." },
      { icon: "target", title: "Goals and Pip's chapters", text: "Daily goals give stars. Pip's chapter shows the steps to the next town rank." },
    ],
  },
  {
    title: "Building towers",
    rows: [
      { icon: "pointer", title: "Tap to drop", text: "Tap to drop the sliding floor. Whatever hangs over the edge breaks off." },
      { icon: "sparkle", title: "Perfect drops", text: "Line it up exactly: nothing breaks off, it pays more, and the tower grows wider again." },
      { icon: "fire", title: "Fever", text: "Eight perfect drops in a row: the next six floors count double." },
      { icon: "ice", title: "Special floors", text: "Gold pays more, ice slides fast, gardens widen your tower. Bubbles carry power-ups." },
      { icon: "city", title: "What a tower does", text: "Its people move into Skyhaven and its floors become offices for your businesses." },
    ],
  },
];

/** One line at the top of each menu page, the first times it's opened. */
export const PAGE_INTRO: Record<string, string> = {
  company: "Your businesses earn cash. Buy levels to earn more; a manager sells for you, even while you're away.",
  shop: "Decorations show up in your town and make every business earn more. Crystals buy the special things.",
  goals: "Pip's chapter is your big goal. Daily goals give stars; the Sky Pass gives a prize at every tier.",
  me: "Your builder profile, the leaderboard of the best towers, and settings.",
};
