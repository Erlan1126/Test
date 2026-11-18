// How a building order reads on screen.
import { t } from "../i18n";
import type { Order } from "../logic/orders";

/** The whole order, e.g. "land 8 wide floors". */
export function orderText(o: Order): string {
  if (o.kind === "wide") return t("land {n} wide floors", { n: o.n });
  if (o.kind === "perfect") return t("land {n} perfect drops", { n: o.n });
  return t("a perfect streak of {n}", { n: o.n });
}

/** What the chip counts while building. */
export function orderUnit(o: Order): string {
  return o.kind === "wide" ? t("wide floors") : o.kind === "perfect" ? t("perfect drops") : t("streak");
}
