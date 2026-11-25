// What the people walking round the city say now and then (a speech bubble over one of them).
// A few lines are about the city as it is right now: the season, the weather, a decoration
// the player placed, the business they opened last.
import type { CitySeason } from "./season";

export const TALK_ANY = [
  "Best coffee in the sky, I swear.",
  "I moved here last week. Already love it!",
  "Have you seen how tall the city's getting?",
  "My cousin wants to move here too.",
  "This street used to be empty grass!",
  "The mayor's hat is very shiny today.",
  "I could walk these streets all day.",
  "Is it just me, or are there more shops every day?",
  "Somebody should build a cinema... oh wait!",
  "I left my umbrella at the bakery again.",
  "Rent's fair, view's amazing. Can't complain.",
  "Five stars for this city. Would live here again.",
];
export const TALK_SEASON: Record<Exclude<CitySeason, "">, string[]> = {
  spring: ["The blossoms smell so good!", "Spring in this city is something else."],
  summer: ["Beach after work, anyone?", "Summer Festival is the best week of the year!"],
  halloween: ["Did that pumpkin just wink at me?", "I'm going as the mayor for Halloween."],
  winter: ["Look at the lights! So pretty.", "Hot cocoa weather!"],
};
export const TALK_RAIN = ["Should've brought my umbrella...", "Rain makes the streets shine."];
export const TALK_SNOW = ["Snowball fight in the plaza later?", "My boots are full of snow!"];
export const TALK_DECOR: Record<string, string> = {
  pocketpark: "That little park is my lunch spot now.",
  fountain: "I threw a coin in the fountain. Wish me luck!",
  garden: "The flower garden smells amazing.",
  statue: "Who's the statue of? The founder? Fancy!",
  market: "Fresh fruit at the market this morning!",
  stadium: "Big game at the stadium tonight!",
  clocktower: "Meet me under the clock tower at noon!",
  lighthouse: "The lighthouse looks magical at night.",
  ferris: "You can see the whole city from the ferris wheel!",
  airport: "Just flew in. What a view on the way down!",
};
export const TALK_NIGHT = ["The night market has the best snacks!", "I love the lanterns in the square at night."];
export const TALK_WEEKEND = ["Fireworks over the sea tonight! Don't miss it."];
export const TALK_RUSH = ["Rush hour! The streets are packed.", "Stuck in traffic again... worth it for this city."];
/** Said about the business just opened: {name} is the business. */
export const TALK_NEW = "Have you tried the new {name} yet?";

/** Picks a line for this moment. `r` is a random number 0-1. */
export function pickTalk(o: { season: CitySeason; weather: string; placed: string[]; newest?: string; night?: boolean; weekend?: boolean; rush?: boolean }, r: number): { text: string; name?: string } {
  const pool: { text: string; name?: string }[] = TALK_ANY.map(text => ({ text }));
  if (o.season) for (const text of TALK_SEASON[o.season]) pool.push({ text }, { text });
  if (o.weather === "rain") for (const text of TALK_RAIN) pool.push({ text }, { text });
  if (o.weather === "snow") for (const text of TALK_SNOW) pool.push({ text }, { text });
  for (const id of o.placed) if (TALK_DECOR[id]) pool.push({ text: TALK_DECOR[id] }, { text: TALK_DECOR[id] });
  if (o.night) for (const text of TALK_NIGHT) pool.push({ text }, { text });
  if (o.weekend) for (const text of TALK_WEEKEND) pool.push({ text }, { text }, { text });
  if (o.rush) for (const text of TALK_RUSH) pool.push({ text }, { text });
  if (o.newest) pool.push({ text: TALK_NEW, name: o.newest }, { text: TALK_NEW, name: o.newest });
  return pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
}
