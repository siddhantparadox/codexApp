export interface BridgePairingPayload {
  v: 1;
  name: string;
  mode: "lan" | "tailscale";
  baseUrl: string;
  pairingToken: string;
  serverPubKeyFingerprint?: string;
  expiresAt: number;
}

export interface SavedConnection extends BridgePairingPayload {
  id: string;
  createdAt: number;
}