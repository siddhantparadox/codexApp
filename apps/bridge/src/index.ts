import process from "node:process";
import { BridgeServer } from "./bridgeServer";
import type { BridgePairingPayload } from "./pairing";

function parsePort(raw: string | undefined): number {
  if (!raw) {
    return 8787;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8787;
  }

  return parsed;
}

async function main(): Promise<void> {
  const host = process.env.BRIDGE_HOST ?? "0.0.0.0";
  const port = parsePort(process.env.BRIDGE_PORT);
  const mode: BridgePairingPayload["mode"] = process.env.BRIDGE_MODE === "tailscale" ? "tailscale" : "lan";

  const options = {
    host,
    port,
    mode,
  } as const;

  const bridge = new BridgeServer({
    ...options,
    ...(process.env.BRIDGE_PUBLIC_HOST ? { advertisedHost: process.env.BRIDGE_PUBLIC_HOST } : {}),
    ...(process.env.BRIDGE_PAIRING_TOKEN ? { pairingToken: process.env.BRIDGE_PAIRING_TOKEN } : {}),
    ...(process.env.CODEX_BIN ? { codexBin: process.env.CODEX_BIN } : {}),
  });

  await bridge.start();
  await bridge.printPairingQr();

  console.log(`Bridge listening on http://${host}:${port}`);
  console.log(`Pairing details: http://${host}:${port}/pairing`);

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
