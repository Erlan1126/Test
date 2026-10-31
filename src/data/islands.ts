// Island themes (unlocked by builder level) and permanent island upgrades (unlocked by
// your best tower passing landmarks).

export interface IslandTheme {
  id: string;
  name: string;
  /** Builder level that unlocks it. */
  level: number;
  tree: "round" | "pine" | "palm";
  lawn: string;
  lip: string;
  lipR: string;
  dirtL: string;
  dirtR: string;
  rockL: string;
  rockR: string;
  plaza: string;
  plaza2: string;
  road: string;
  leaf: [string, string];
  trunk: string;
  /** Gallery preview sky. */
  sky: [string, string];
}

export const ISLAND_THEMES: IslandTheme[] = [
  { id: "meadow", name: "Green Meadow", level: 1, tree: "round", lawn: "#7fc76a", lip: "#5fae4e", lipR: "#4e9640",
    dirtL: "#a07a52", dirtR: "#86643f", rockL: "#7a5b43", rockR: "#5a4334", plaza: "#c9cfd8", plaza2: "#e3e7ec",
    road: "#7d8597", leaf: ["#3f9b4a", "#6bbf4e"], trunk: "#7a5536", sky: ["#4f8fe0", "#ffd9b5"] },
  { id: "snow", name: "Snowy Peaks", level: 3, tree: "pine", lawn: "#eef4fb", lip: "#d6e3f1", lipR: "#c2d2e4",
    dirtL: "#8a96a8", dirtR: "#717d90", rockL: "#5f6a7c", rockR: "#4b5566", plaza: "#c3cdd8", plaza2: "#dfe6ee",
    road: "#6b7385", leaf: ["#2f6b4f", "#3f8a63"], trunk: "#6b4a33", sky: ["#6f9fe0", "#e7f1ff"] },
  { id: "desert", name: "Desert Oasis", level: 6, tree: "palm", lawn: "#ecd29b", lip: "#dcbc7d", lipR: "#c9a866",
    dirtL: "#c08a52", dirtR: "#a5733f", rockL: "#94603a", rockR: "#7a4d2d", plaza: "#d8c3a0", plaza2: "#efe0c4",
    road: "#9a8a76", leaf: ["#3f9b4a", "#7cc35a"], trunk: "#a0703c", sky: ["#5aa0e6", "#ffe2b0"] },
  { id: "blossom", name: "Cherry Blossom", level: 10, tree: "round", lawn: "#a8d88a", lip: "#8cc56e", lipR: "#79b45d",
    dirtL: "#a07a52", dirtR: "#86643f", rockL: "#7a5b43", rockR: "#5a4334", plaza: "#e6d3dc", plaza2: "#f6e9ef",
    road: "#8a8296", leaf: ["#f48fb8", "#ffc8dd"], trunk: "#6e4a3a", sky: ["#8f8fe6", "#ffd6e6"] },
];

/** Upgrades in build order; `at` is the landmark index your best tower must pass. */
export const ISLAND_UPGRADES = [
  { at: 0, name: "Fountain plaza" },
  { at: 1, name: "Duck pond" },
  { at: 2, name: "New neighbors" },
  { at: 3, name: "Street lights and traffic" },
  { at: 4, name: "Ferris wheel" },
  { at: 5, name: "Hot-air balloons" },
];
