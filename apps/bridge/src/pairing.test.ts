import { describe, expect, it } from "vitest";
import {
  buildPairingPayload,
  createPairingToken,
  extractBearerToken,
  isAuthorized,
  resolveAdvertisedHost,
} from "./pairing";

describe("pairing utilities", () => {
  it("creates URL-safe pairing tokens", () => {
    const token = createPairingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(10);
  });

  it("builds pairing payload", () => {
    const payload = buildPairingPayload({
      machineName: "dev-machine",
      mode: "lan",
      wsUrl: "ws://127.0.0.1:8787/ws",
      pairingToken: "token",
      ttlSeconds: 10,
    });

    expect(payload.v).toBe(1);
    expect(payload.name).toBe("dev-machine");
    expect(payload.baseUrl).toContain("ws://");
  });

  it("extracts bearer token", () => {
    expect(extractBearerToken("Bearer abc")).toBe("abc");
    expect(extractBearerToken("Basic abc")).toBeNull();
  });

  it("authorizes header or query token", () => {
    expect(isAuthorized("abc", "Bearer abc", null)).toBe(true);
    expect(isAuthorized("abc", undefined, "abc")).toBe(true);
    expect(isAuthorized("abc", "Bearer x", "y")).toBe(false);
  });

  it("resolves a host", () => {
    expect(resolveAdvertisedHost("100.88.0.2")).toBe("100.88.0.2");
    expect(resolveAdvertisedHost()).toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});