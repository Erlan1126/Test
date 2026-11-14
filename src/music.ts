// The game's music, composed on the fly. Each island has its own song (key, scale, tempo,
// chords), every song has a verse and a chorus, and each section has a real melody: a short
// motif that repeats and answers itself, resolving home at the end, generated once from a
// seed so the tune is the same every time you hear it (it becomes familiar, even catchy).
//
// This file only decides WHAT plays on each eighth note; sound.ts makes the sounds.

/** A chord as scale degrees (0 = the key's first note of the scale). */
type Chord = number[];

export interface Song {
  id: string;
  /** Root note in semitones above C3. */
  root: number;
  bpm: number;
  /** The scale, as semitones above the root (seven notes, or five for pentatonic). */
  scale: number[];
  /** Verse and chorus: one chord per bar, eight bars each. */
  verse: Chord[];
  chorus: Chord[];
  /** How the drums feel: 0 none, 1 soft, 2 driving. */
  drive: number;
  /** Bells over the top. */
  sparkle: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PHRYGIAN_DOM = [0, 1, 4, 5, 7, 8, 10];
const HIRAJOSHI = [0, 2, 3, 7, 8];

/** Triad (or seventh) on a scale degree. */
const tri = (d: number, seventh = false): Chord => (seventh ? [d, d + 2, d + 4, d + 6] : [d, d + 2, d + 4]);

export const SONGS: Record<string, Song> = {
  // Bright and easy: I V vi IV, then a lifting chorus.
  meadow: { id: "meadow", root: 0, bpm: 88, scale: MAJOR, drive: 1, sparkle: true,
    verse: [tri(0), tri(4), tri(5), tri(3), tri(0), tri(4), tri(3, true), tri(4)],
    chorus: [tri(5), tri(3), tri(0), tri(4), tri(5), tri(3), tri(1, true), tri(4, true)] },
  // Slow, airy and glittering, with the dreamy raised fourth.
  snow: { id: "snow", root: 2, bpm: 74, scale: LYDIAN, drive: 0, sparkle: true,
    verse: [tri(0, true), tri(1), tri(0, true), tri(1), tri(5), tri(4), tri(1), tri(0, true)],
    chorus: [tri(3, true), tri(4), tri(5), tri(1), tri(3, true), tri(4), tri(1), tri(0, true)] },
  // Warm and exotic, over a steady camel-walk.
  desert: { id: "desert", root: 4, bpm: 92, scale: PHRYGIAN_DOM, drive: 1, sparkle: false,
    verse: [tri(0), tri(1), tri(0), tri(1), tri(6), tri(5), tri(1), tri(0)],
    chorus: [tri(5), tri(6), tri(0), tri(1), tri(5), tri(6), tri(1), tri(0)] },
  // Gentle and wistful, in a Japanese pentatonic.
  blossom: { id: "blossom", root: 9, bpm: 78, scale: HIRAJOSHI, drive: 0, sparkle: true,
    verse: [[0, 2, 4], [3, 0, 2], [0, 2, 4], [1, 3, 0], [3, 0, 2], [0, 2, 4], [1, 3, 0], [0, 2, 4]],
    chorus: [[3, 0, 2], [4, 1, 3], [0, 2, 4], [1, 3, 0], [3, 0, 2], [4, 1, 3], [1, 3, 0], [0, 2, 4]] },
  // Dark, driving minor.
  volcano: { id: "volcano", root: 2, bpm: 100, scale: MINOR, drive: 2, sparkle: false,
    verse: [tri(0), tri(5), tri(2), tri(6), tri(0), tri(5), tri(3), tri(4)],
    chorus: [tri(5), tri(6), tri(0), tri(0), tri(5), tri(6), tri(3), tri(4)] },
  // Bouncy and sweet: I vi ii V.
  candy: { id: "candy", root: 5, bpm: 108, scale: MAJOR, drive: 1, sparkle: true,
    verse: [tri(0), tri(5), tri(1, true), tri(4, true), tri(0), tri(5), tri(1, true), tri(4, true)],
    chorus: [tri(3), tri(4), tri(2), tri(5), tri(3), tri(4), tri(1, true), tri(4, true)] },
};

export const songFor = (id: string): Song => SONGS[id] ?? SONGS.meadow;

/** Semitones above C3 for a scale degree (any integer; wraps into higher/lower octaves). */
export function degreeToSemi(song: Song, degree: number): number {
  const n = song.scale.length, oct = Math.floor(degree / n), i = ((degree % n) + n) % n;
  return song.root + song.scale[i] + oct * 12;
}

// ---------- Melody ----------

/** A tiny seeded random generator, so each song's melody is the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Rhythms for one bar of eight eighth notes: 1 = a note starts, 0 = rest or held. */
const RHYTHMS = [
  [1, 0, 1, 0, 1, 1, 1, 0], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 1, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 0, 1, 1, 0], [0, 0, 1, 0, 1, 0, 1, 1], [1, 0, 0, 0, 1, 0, 1, 0],
];

/** One melody note: its scale degree and how many eighths it lasts. */
export interface Note { deg: number; len: number }

const cache = new Map<string, (Note | null)[]>();

/** The melody for a section (64 eighths): a two-bar motif, its answer, the motif again
 *  over new chords, and a cadence that comes home. null = no new note on that eighth. */
export function melody(song: Song, section: "verse" | "chorus"): (Note | null)[] {
  const key = `${song.id}|${section}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const chords = song[section], r = rng(song.root * 131 + song.bpm * 17 + (section === "chorus" ? 7 : 1));
  const n = song.scale.length, top = n + 4, bottom = 0;
  const out: (Note | null)[] = new Array(64).fill(null);
  // Two bars of rhythm and contour, reused in bars 3-4 and 5-6 (that's what makes a tune).
  const motif = [RHYTHMS[Math.floor(r() * RHYTHMS.length)], RHYTHMS[Math.floor(r() * RHYTHMS.length)]];
  const contour = Array.from({ length: 16 }, () => (r() < 0.55 ? 1 : -1) * (r() < 0.75 ? 1 : 2));
  let deg = chords[0][0] + n; // start on the chord's root, an octave up
  for (let bar = 0; bar < 8; bar++) {
    const chord = chords[bar], rhythm = bar === 7 ? [1, 0, 0, 0, 0, 0, 0, 0] : motif[bar % 2];
    const answer = bar === 2 || bar === 3;
    for (let e = 0; e < 8; e++) {
      if (!rhythm[e]) continue;
      if (bar === 7) deg = chords[7][0] + n;               // cadence: land on the root
      else if (e === 0 || e === 4) {
        // Strong beats: the chord tone nearest where the tune is.
        const tones = chord.flatMap(c => [c, c + n, c + 2 * n]).filter(x => x >= bottom && x <= top);
        deg = tones.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a), tones[0]);
      } else {
        // Weak beats: step along the contour (inverted for the answering phrase).
        deg += contour[(bar % 2) * 8 + e] * (answer ? -1 : 1);
        if (deg > top) deg -= 2; else if (deg < bottom) deg += 2;
      }
      let len = 1;
      while (e + len < 8 && !rhythm[e + len]) len++;
      out[bar * 8 + e] = { deg, len: bar === 7 ? 8 : len };
    }
  }
  cache.set(key, out);
  return out;
}

/** Which section plays: verse, verse, chorus, verse... then round again (32 bars). */
export function sectionAt(bar: number): { section: "verse" | "chorus"; barInSection: number; lastBarOfSection: boolean } {
  const block = Math.floor(bar / 8) % 4, barInSection = bar % 8;
  return { section: block === 2 ? "chorus" : "verse", barInSection, lastBarOfSection: barInSection === 7 };
}
