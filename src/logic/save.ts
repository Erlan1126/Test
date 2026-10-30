// Player progress saved in the browser. Storage can be unavailable (private
// browsing, blocked site data), so every access is guarded.
export interface SaveData {
  best: number;
  stars: number;
  games: number;
  sound: boolean;
}

const KEY = "orbitHop.save.v1";
const DEFAULTS: SaveData = { best: 0, stars: 0, games: 0, sound: true };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Fall through to defaults.
  }
  return { ...DEFAULTS };
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Progress just won't persist this session.
  }
}
