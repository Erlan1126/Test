// The phone apps (App Store and Google Play) run this same game inside Capacitor. This file
// holds everything that only applies there: real haptics, the Android back button, daily
// reminder notifications, the system share sheet and a backup copy of the save. On the
// website every function here quietly does nothing, so the game code can call them freely.
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar } from "@capacitor/status-bar";
import { t } from "./i18n";

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): "ios" | "android" | "web" => Capacitor.getPlatform() as "ios" | "android" | "web";

/** Hides the status bar and the splash screen once the game has drawn its first frame. */
export function nativeReady(): void {
  if (!isNative()) return;
  void StatusBar.hide().catch(() => {});
  void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

// ---------- Haptics ----------

export type Buzz = "tap" | "land" | "perfect" | "success" | "fail";

/** A short haptic. Returns false on the website, where the caller falls back to vibrate(). */
export function haptic(kind: Buzz): boolean {
  if (!isNative()) return false;
  const go = kind === "tap" ? Haptics.impact({ style: ImpactStyle.Light })
    : kind === "land" ? Haptics.impact({ style: ImpactStyle.Medium })
    : kind === "perfect" ? Haptics.impact({ style: ImpactStyle.Heavy })
    : Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Error });
  void go.catch(() => {});
  return true;
}

// ---------- Android back button ----------

/** `handler` returns true when it used the press (closed a sheet, paused, went back). */
export function onBackButton(handler: () => boolean): void {
  if (platform() !== "android") return;
  void CapApp.addListener("backButton", () => { if (!handler()) void CapApp.minimizeApp().catch(() => CapApp.exitApp()); });
}

// ---------- Share ----------

/** The system share sheet. Returns false when it isn't available (the website uses its own). */
export async function nativeShare(text: string, image: Blob | null): Promise<boolean> {
  if (!isNative()) return false;
  try {
    let files: string[] | undefined;
    if (image) {
      // The share sheet needs a real file, so the picture goes to the app's cache first.
      const data = await blobToBase64(image);
      const saved = await Filesystem.writeFile({ path: "skyrise-share.png", data, directory: Directory.Cache });
      files = [saved.uri];
    }
    await Share.share({ title: "Skyrise", text, files });
  } catch (e) {
    // Closing the share sheet counts as handled.
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) return false;
  }
  return true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// ---------- Daily reminders ----------

const REMINDER_KEY = "skyrise.reminder";
const REMINDER_IDS = [101, 102, 103];

/** The reminder time ("19:00") or "" when reminders are off. Kept apart from the save. */
export function reminderTime(): string {
  try { return localStorage.getItem(REMINDER_KEY) ?? ""; } catch { return ""; }
}

/** Turns daily reminders on at `time` (asking for permission), or off with "". */
export async function setReminder(time: string, info: ReminderInfo): Promise<"on" | "off" | "denied"> {
  if (time) {
    const perm = await LocalNotifications.requestPermissions().catch(() => ({ display: "denied" }));
    if (perm.display !== "granted") return "denied";
  }
  try { if (time) localStorage.setItem(REMINDER_KEY, time); else localStorage.removeItem(REMINDER_KEY); } catch { /* storage off */ }
  await scheduleReminders(info);
  return time ? "on" : "off";
}

export interface ReminderInfo { doneToday: boolean; streak: number; rentFull: boolean }

/**
 * Plans the next three reminders. Today's is skipped once today's tower is built, so a
 * reminder only shows up on days the player hasn't played yet. Called whenever the app
 * goes to the background and after each tower.
 */
export async function scheduleReminders(info: ReminderInfo): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: REMINDER_IDS.map(id => ({ id })) });
    const time = reminderTime();
    if (!time) return;
    const [hh, mm] = time.split(":").map(Number);
    const now = Date.now();
    const notifications = [];
    for (let day = 0, n = 0; n < REMINDER_IDS.length && day < 4; day++) {
      if (day === 0 && info.doneToday) continue;
      const at = new Date();
      at.setDate(at.getDate() + day);
      at.setHours(hh || 19, mm || 0, 0, 0);
      if (at.getTime() <= now + 60_000) continue;
      const first = n === 0;
      notifications.push({
        id: REMINDER_IDS[n++],
        title: first && info.streak > 0 ? t("🔥 Keep your {n}-day streak going", { n: info.streak }) : t("🏙️ Your skyline is waiting"),
        body: first && info.rentFull ? t("Your rent is ready to collect, and today's tower is waiting.")
          : t("Today's daily tower and missions are ready. One quick tower?"),
        schedule: { at, allowWhileIdle: true },
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch { /* notifications unavailable */ }
}

/** Runs `fn` each time the app goes to the background. */
export function onAppHidden(fn: () => void): void {
  if (!isNative()) return;
  void CapApp.addListener("pause", fn);
}

// ---------- Save backup ----------

// Phones can clear a web view's storage when space runs low, so the apps keep a second
// copy of the save in native storage and restore it if the web copy goes missing.
const BACKUP_KEY = "skyrise.save.backup";

export function backupSave(json: string): void {
  if (!isNative()) return;
  void Preferences.set({ key: BACKUP_KEY, value: json }).catch(() => {});
}

/** The backed-up save, if there is one. */
export async function readBackup(): Promise<string | null> {
  if (!isNative()) return null;
  try { return (await Preferences.get({ key: BACKUP_KEY })).value; } catch { return null; }
}

// ---------- Store rating ----------

const REVIEW_KEY = "skyrise.review";

/**
 * Asks for a store rating at a happy moment (a new best). The stores decide whether the
 * card actually shows, and we ask at most once every 90 days, and never in the first towers.
 */
export function askForReview(towers: number): void {
  if (!isNative() || towers < 8) return;
  try {
    const last = Number(localStorage.getItem(REVIEW_KEY)) || 0;
    if (Date.now() - last < 90 * 864e5) return;
    localStorage.setItem(REVIEW_KEY, String(Date.now()));
  } catch { return; }
  void import("@capacitor-community/in-app-review").then(m => m.InAppReview.requestReview()).catch(() => {});
}
