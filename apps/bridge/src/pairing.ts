import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";

export interface BridgePairingPayload {
  v: 1;
  name: string;
  mode: "lan" | "tailscale";
  baseUrl: string;
  pairingToken: string;
  serverPubKeyFingerprint?: string;
  expiresAt: number;
}

export function createPairingToken(): string {
  return randomBytes(24).toString("base64url");
}

export function resolveAdvertisedHost(
  preferredHost?: string,
  mode: "lan" | "tailscale" = "lan",
): string {
  if (preferredHost) {
    return preferredHost;
  }

  const interfaces = networkInterfaces();
  let fallbackLan: string | null = null;
  for (const values of Object.values(interfaces)) {
    if (!values) {
      continue;
    }

    for (const entry of values) {
      if (entry.family === "IPv4" && !entry.internal) {
        if (mode === "tailscale" && entry.address.startsWith("100.")) {
          return entry.address;
        }
        fallbackLan ??= entry.address;
      }
    }
  }

  return fallbackLan ?? "127.0.0.1";
}

export function buildPairingPayload(input: {
  machineName: string;
  mode: "lan" | "tailscale";
  wsUrl: string;
  pairingToken: string;
  ttlSeconds?: number;
  fingerprint?: string;
}): BridgePairingPayload {
  const ttl = input.ttlSeconds ?? 60 * 60;

  const payload: BridgePairingPayload = {
    v: 1,
    name: input.machineName,
    mode: input.mode,
    baseUrl: input.wsUrl,
    pairingToken: input.pairingToken,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
  };

  if (input.fingerprint) {
    payload.serverPubKeyFingerprint = input.fingerprint;
  }

  return payload;
}

export function extractBearerToken(headerValue?: string): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function isAuthorized(token: string, authHeader?: string, queryToken?: string | null): boolean {
  const bearer = extractBearerToken(authHeader);
  return bearer === token || queryToken === token;
}
