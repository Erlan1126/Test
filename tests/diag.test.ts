// Crash and error reports: the optional Sentry copy goes to the right place, says which
// game sent it, and carries nothing personal.
import { describe, expect, it } from "vitest";
import { sentryEnvelope, sentryTarget } from "../src/diag";

describe("error reports", () => {
  it("read a Sentry DSN, and ignore an empty or broken one", () => {
    expect(sentryTarget("https://abc123@o42.ingest.us.sentry.io/456")).toEqual({ url: "https://o42.ingest.us.sentry.io/api/456/envelope/", key: "abc123" });
    expect(sentryTarget("")).toBeNull();
    expect(sentryTarget("not a dsn")).toBeNull();
  });

  it("make a Sentry envelope with the game, version and screen, and nothing personal", () => {
    const env = sentryEnvelope(
      { kind: "error", msg: "boom", data: { at: "index.js:1:2", stack: "Error: boom", screen: "playing" } },
      { version: "1.0 (7)", device: "iPhone · Apple GPU", game: "skyrise", dsn: "https://k@o1.ingest.sentry.io/2" },
      new Date("2026-11-28T00:00:00Z"),
    );
    const [head, item, body] = env.split("\n").map(l => JSON.parse(l));
    expect(head.dsn).toBe("https://k@o1.ingest.sentry.io/2");
    expect(item.type).toBe("event");
    expect(body.event_id).toBe(head.event_id);
    expect(body.release).toBe("skyrise@1.0 (7)");
    expect(body.tags).toMatchObject({ game: "skyrise", screen: "playing" });
    expect(body.exception.values[0].value).toBe("boom");
    expect(JSON.stringify(body)).not.toMatch(/player|nickname|user|ip_address/i);
  });
});
