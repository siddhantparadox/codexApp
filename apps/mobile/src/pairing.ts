import type { BridgePairingPayload } from "./types";

export function parsePairingPayload(raw: string): BridgePairingPayload {
  const parsed = JSON.parse(raw) as Partial<BridgePairingPayload>;

  if (parsed.v !== 1) {
    throw new Error("Unsupported pairing payload version");
  }

  if (!parsed.baseUrl || !parsed.pairingToken || !parsed.name || !parsed.expiresAt) {
    throw new Error("Invalid pairing payload");
  }

  return {
    v: 1,
    name: parsed.name,
    mode: parsed.mode === "tailscale" ? "tailscale" : "lan",
    baseUrl: parsed.baseUrl,
    pairingToken: parsed.pairingToken,
    expiresAt: parsed.expiresAt,
    serverPubKeyFingerprint: parsed.serverPubKeyFingerprint,
  };
}

export function withToken(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  if (!url.searchParams.has("token")) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}