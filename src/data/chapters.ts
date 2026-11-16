// The story of Skyhaven, told by Mayor Pip in chapters. Each chapter has three goals made
// from things the player does anyway (towers, height, people, city buildings...); finishing
// all three pays a reward and opens the next chapter. It gives the game a beginning, a
// middle and an end: from an empty meadow to the capital of the sky.
import { districtTowers } from "../logic/skyline";
import type { SaveData } from "../logic/save";

export interface ChapterGoal {
  /** "Build {n} towers" style text; {n} is the target. */
  text: string;
  need: number;
  have: (s: SaveData) => number;
}

export interface Chapter {
  title: string;
  /** What Mayor Pip says when the chapter starts. */
  intro: string;
  /** What Mayor Pip says when it's done. */
  outro: string;
  goals: ChapterGoal[];
  reward: { stars: number; crystals: number };
}

const towers = (s: SaveData) => s.profile.towers;
const best = (s: SaveData) => s.bestMeters;
const people = (s: SaveData) => s.population;
const builds = (s: SaveData) => s.city.length;
const level = (s: SaveData) => s.profile.level;
const inDistrict = (d: string) => (s: SaveData) => districtTowers(s, d).length;
const managers = (s: SaveData) => s.tycoon.managers.length;
const earned = (s: SaveData) => s.tycoon.lifetime;
const businesses = (s: SaveData) => Object.keys(s.tycoon.levels).length;
const eras = (s: SaveData) => s.tycoon.eras;

export const CHAPTERS: Chapter[] = [
  {
    title: "A city in the sky",
    intro: "Welcome to Skyhaven! It's just a meadow for now, but with your towers it'll be the greatest city in the sky. Let's begin!",
    outro: "Look at that skyline! People are already moving in. You're a natural.",
    goals: [
      { text: "Build {n} towers", need: 3, have: towers },
      { text: "Build a tower {n} m tall", need: 30, have: best },
      { text: "Reach builder level {n}", need: 2, have: level },
    ],
    reward: { stars: 10, crystals: 20 },
  },
  {
    title: "Growing up",
    intro: "Skyhaven is growing! More people means more rent, and more rent means more buildings.",
    outro: "{city} has a real heartbeat now. Time to look beyond the meadow...",
    goals: [
      { text: "Reach {n} people", need: 5000, have: people },
      { text: "Reach builder level {n}", need: 5, have: level },
      { text: "Build {n} city building", need: 1, have: builds },
      { text: "Hire {n} manager in Skyhaven Inc.", need: 1, have: managers },
    ],
    reward: { stars: 15, crystals: 30 },
  },
  {
    title: "The Snowy Peaks",
    intro: "Over the clouds there's an island covered in snow. Grow the city to open it, then build there!",
    outro: "Your towers sparkle in the snow. The whole sky is talking about Skyhaven!",
    goals: [
      { text: "Reach {n} people", need: 15000, have: people },
      { text: "Build {n} towers in Snowy Peaks", need: 3, have: inDistrict("snow") },
      { text: "Build {n} city buildings", need: 3, have: builds },
      { text: "Earn {n} coins in Skyhaven Inc.", need: 1e6, have: earned },
    ],
    reward: { stars: 20, crystals: 40 },
  },
  {
    title: "The Desert Oasis",
    intro: "Next stop: a warm oasis of palm trees and sand. It needs a skyline only you can build.",
    outro: "An oasis of glass and gold. I could watch the sunset from your towers all day.",
    goals: [
      { text: "Reach {n} people", need: 60000, have: people },
      { text: "Build {n} towers in Desert Oasis", need: 3, have: inDistrict("desert") },
      { text: "Build a tower {n} m tall", need: 200, have: best },
      { text: "Open {n} businesses", need: 5, have: businesses },
    ],
    reward: { stars: 30, crystals: 60 },
  },
  {
    title: "Cherry Blossom",
    intro: "The cherry trees are in bloom on the next island. Let's give it towers worth the view.",
    outro: "Pink petals and perfect towers. Skyhaven has never looked so lovely.",
    goals: [
      { text: "Reach {n} people", need: 180000, have: people },
      { text: "Build {n} towers in Cherry Blossom", need: 3, have: inDistrict("blossom") },
      { text: "Build {n} city buildings", need: 8, have: builds },
      { text: "Earn {n} coins in Skyhaven Inc.", need: 5e7, have: earned },
    ],
    reward: { stars: 40, crystals: 80 },
  },
  {
    title: "Capital of the sky",
    intro: "One last dream: make Skyhaven the capital of the sky. Half a million people, and a tower to match!",
    outro: "You did it! Skyhaven is the capital of the sky, and you built every floor of it. Thank you, builder!",
    goals: [
      { text: "Reach {n} people", need: 500000, have: people },
      { text: "Build a tower {n} m tall", need: 500, have: best },
      { text: "Reach builder level {n}", need: 20, have: level },
      { text: "Start {n} New Era", need: 1, have: eras },
    ],
    reward: { stars: 60, crystals: 150 },
  },
];

/** The chapter the player is on (CHAPTERS.length once the story is finished). */
export const chapterIndex = (s: SaveData): number => Math.min(s.chapters.done, CHAPTERS.length);
export const goalDone = (s: SaveData, g: ChapterGoal): boolean => g.have(s) >= g.need;
export const chapterReady = (s: SaveData): boolean => {
  const c = CHAPTERS[chapterIndex(s)];
  return !!c && c.goals.every(g => goalDone(s, g));
};

/** Pays the finished chapter and moves on. Returns its reward, or null if not ready. */
export function claimChapter(s: SaveData): Chapter["reward"] | null {
  if (!chapterReady(s)) return null;
  const c = CHAPTERS[chapterIndex(s)];
  s.chapters.done++;
  s.stars += c.reward.stars;
  s.starsEarned += c.reward.stars;
  s.crystals += c.reward.crystals;
  return c.reward;
}
