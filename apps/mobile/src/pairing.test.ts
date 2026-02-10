import { describe, expect, it } from "vitest";
import { parsePairingPayload, withToken } from "./pairing";

describe("pairing helpers", () => {
  it("parses valid payload", () => {
    const payload = parsePairingPayload(
      JSON.stringify({
        v: 1,
        name: "Laptop",
        mode: "lan",
        baseUrl: "ws://192.168.1.10:8787/ws",
        pairingToken: "abc",
        expiresAt: 9999999999,
      }),
    );

    expect(payload.name).toBe("Laptop");
  });

  it("adds token to websocket URL", () => {
    expect(withToken("ws://localhost:8787/ws", "abc")).toContain("token=abc");
  });
});