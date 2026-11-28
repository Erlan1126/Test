// Store product ids. Inside the game a pack is always known by its plain id
// ("crystals_200"); only the App Store and Google Play see the ids below.
//
// Apple product ids are unique across the whole developer account, not per app, and can
// never be used again once created. Buildaroo and Skyrise are separate apps on one
// account, so on the App Store the Skyrise build asks for its own "skyrise."-prefixed ids
// (see store/skyrise/LISTING.md). Google Play ids are per app, so both games use the plain
// ids there.
import { EDITION } from "../edition";
import { VIP_ID as VIP_ANDROID, VIP_ID_IOS } from "../logic/vip";

/** The App Store prefix for this build's products. */
export const IOS_PREFIX = EDITION === "skyrise" ? "skyrise." : "";

/** VIP's store id. Buildaroo keeps the App Store id it already has. */
export function vipStoreId(ios: boolean): string {
  if (!ios) return VIP_ANDROID;
  return IOS_PREFIX ? `${IOS_PREFIX}${VIP_ANDROID}` : VIP_ID_IOS;
}

/** A pack's id in the store. */
export const packStoreId = (id: string, ios: boolean): string => (ios ? IOS_PREFIX + id : id);

/** The game's own id for a product id the store reports. */
export const ourId = (storeId: string, ios: boolean): string =>
  ios && IOS_PREFIX && storeId.startsWith(IOS_PREFIX) ? storeId.slice(IOS_PREFIX.length) : storeId;
