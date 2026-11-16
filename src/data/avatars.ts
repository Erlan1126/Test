// Your builder's look: an icon on a colored badge, inside a frame you earn.
import type { SaveData } from "../logic/save";
import { iconSvg } from "../ui/icons";

export const AVATARS = ["tower", "city", "rocket", "crown", "star", "sun", "balloon", "airship", "lighthouse", "pagoda", "windmill", "statue"];
export const AVATAR_COLORS = [
  ["#4f8bff", "#6a4cff"], ["#ff8fb8", "#f0457a"], ["#ffd23f", "#ff9a1f"], ["#5ee0a0", "#19a87a"],
  ["#4fc3ff", "#3a6cf0"], ["#c48bff", "#7b4cff"], ["#ff9a5c", "#ff4f4f"], ["#8a96b5", "#3a4570"],
];

export type FrameId = "none" | "silver" | "gold" | "diamond";
export const FRAMES: { id: FrameId; name: string; how: string; open: (s: SaveData) => boolean }[] = [
  { id: "none", name: "No frame", how: "", open: () => true },
  { id: "silver", name: "Silver frame", how: "Reach builder level 10", open: s => s.profile.level >= 10 },
  { id: "gold", name: "Gold frame", how: "Reach level 20, or get the 8,000 crystal pack", open: s => s.profile.level >= 20 || s.packsFirst.includes("crystals_8000") || s.packsFirst.includes("crystals_14000") },
  { id: "diamond", name: "Diamond frame", how: "Comes with the 14,000 crystal pack", open: s => s.purchases.includes("pack_diamond") },
];

/** The player's avatar, ready to drop into the page. */
export function avatarBadge(s: SaveData, cls = ""): string {
  const frame = FRAMES.find(f => f.id === s.profile.frame && f.open(s))?.id ?? "none";
  return avatarBadgeFor(s.profile.avatar, s.profile.avatarColor, frame, cls);
}

/** Someone else's avatar (a friend's), from its parts. */
export function avatarBadgeFor(avatar: string, color: number, frame: string, cls = ""): string {
  const a = AVATARS.includes(avatar) ? avatar : "tower";
  const [c1, c2] = AVATAR_COLORS[(Math.abs(Math.floor(color)) || 0) % AVATAR_COLORS.length];
  const f = FRAMES.some(x => x.id === frame) ? frame : "none";
  return `<span class="avatar-badge frame-${f} ${cls}" style="--a1:${c1};--a2:${c2}" aria-hidden="true">${iconSvg(a)}</span>`;
}
