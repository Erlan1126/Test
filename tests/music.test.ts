import { describe, expect, it } from "vitest";
import { degreeToSemi, melody, sectionAt, SONGS } from "../src/music";

describe("music", () => {
  it("has a song with a full melody for every island, ending home", () => {
    for (const id of ["meadow", "snow", "desert", "blossom", "volcano", "candy"]) {
      const song = SONGS[id];
      expect(song).toBeTruthy();
      for (const section of ["verse", "chorus"] as const) {
        expect(song[section]).toHaveLength(8);
        const m = melody(song, section);
        expect(m).toHaveLength(64);
        const notes = m.filter(Boolean);
        expect(notes.length).toBeGreaterThan(12);
        // The last bar lands on the root of its chord.
        const last = m[56]!;
        expect(((last.deg - song[section][7][0]) % song.scale.length + song.scale.length) % song.scale.length).toBe(0);
        // Notes stay in a singable range (about two octaves).
        for (const n of notes) expect(Math.abs(degreeToSemi(song, n!.deg) - song.root)).toBeLessThanOrEqual(26);
      }
      // The same every time (a tune you can learn).
      expect(melody(song, "verse")).toBe(melody(song, "verse"));
    }
  });

  it("plays verse, verse, chorus, verse", () => {
    expect([0, 8, 16, 24, 32].map(b => sectionAt(b).section)).toEqual(["verse", "verse", "chorus", "verse", "verse"]);
    expect(sectionAt(15).lastBarOfSection).toBe(true);
  });
});
