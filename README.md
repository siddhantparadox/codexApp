# Codex Mobile

Codex Mobile is an Expo React Native client that controls a local `codex app-server` through a laptop bridge.

V1 supports:
- Home LAN usage (phone + computer on same Wi-Fi)
- Remote usage over Tailscale (computer must stay on)
- Threaded chat, streamed tool activity, and approval handling

## Prerequisites

- Node.js 20+
- PNPM (recommended through Corepack)
- `codex` CLI installed and available on your PATH
- Expo Go installed on your phone

## Install

From repo root:

```powershell
corepack enable
pnpm install
```

Optional verification:

```powershell
codex --version
```

## Run On Your Phone (Expo Go)

Use two terminals from repo root.

Recommended command style for interactive local runs:
- `pnpm --filter @codex-remote/bridge dev`
- `pnpm --filter @codex-remote/mobile start -- --lan`

This avoids terminal/runner setups where QR output is not rendered.

### 1) Start the bridge (Terminal A)

LAN mode (default):

```powershell
pnpm dev:bridge
```

Tailscale mode:

```powershell
$env:BRIDGE_MODE="tailscale"; pnpm dev:bridge
```

What this does:
- Starts the local bridge server (default `0.0.0.0:8787`)
- Spawns `codex app-server`
- Prints a bridge pairing QR code in the terminal

### 2) Start Expo dev server (Terminal B)

```powershell
pnpm dev:mobile
```

This shows the Expo QR code.

### 3) Open app in Expo Go

- Open Expo Go on your phone.
- Scan the Expo QR code from Terminal B.
- Wait for the app to load.

### 4) Pair mobile app with your computer bridge

- In the app, tap `Scan QR code`.
- Scan the bridge pairing QR code from Terminal A.
- After connection succeeds, create a chat and send a prompt.

## Same Wi-Fi Setup (No QR Required)

If QR codes are not visible in your terminal, use this exact manual flow.

1. Find your computer Wi-Fi IPv4:

```powershell
ipconfig
```

2. Start bridge directly:

```powershell
$env:BRIDGE_HOST="0.0.0.0"
$env:BRIDGE_MODE="lan"
pnpm --filter @codex-remote/bridge dev
```

3. On your computer, open:

```text
http://127.0.0.1:8787/pairing
```

Copy `wsUrl` and `pairingToken`.

4. Start Expo directly:

```powershell
pnpm --filter @codex-remote/mobile start -- --lan
```

5. In Expo Go on your phone, tap `Enter URL manually` and paste the printed `exp://...` URL.

6. In the app, tap `Enter details manually` and paste:
- `WS URL` = `wsUrl` from `/pairing`
- `Pairing token` = `pairingToken` from `/pairing`

7. Optional network test from phone browser:

```text
http://<your-computer-ip>:8787/health
```

## Environment Variables (Bridge)

- `BRIDGE_HOST` (default `0.0.0.0`)
- `BRIDGE_PORT` (default `8787`)
- `BRIDGE_MODE` (`lan` or `tailscale`)
- `BRIDGE_PUBLIC_HOST` (override advertised host in QR payload)
- `BRIDGE_PAIRING_TOKEN` (override generated token)
- `CODEX_BIN` (override Codex CLI binary path)
- `CODEX_SHELL` (Windows shell for launching Codex; default `pwsh.exe`)

Example:

```powershell
$env:BRIDGE_PORT="8787"
$env:BRIDGE_MODE="tailscale"
$env:CODEX_SHELL="pwsh.exe"
pnpm dev:bridge
```

## Troubleshooting

1. Check phone reachability to bridge:
```text
http://<computer-ip-or-tailnet-ip>:8787/health
```

2. If pairing fails:
- Confirm phone and computer are on the same Wi-Fi (LAN mode), or both connected to same tailnet (Tailscale mode).
- Ensure local firewall allows inbound traffic on bridge port `8787`.

3. If bridge cannot start Codex:
- Run `codex app-server` manually once on your computer and fix CLI/auth issues.
- Ensure `codex` is on PATH, or set `CODEX_BIN`.

4. If Expo Go cannot load app:
- Ensure phone and dev machine can reach Metro.
- Restart Expo dev server: `pnpm dev:mobile`.
- Prefer direct start command for local phone testing:
  `pnpm --filter @codex-remote/mobile start -- --lan`.

5. If bridge logs include `missing rollout path for thread ...`:
- This is stale local Codex thread state on the computer.
- In app, open a new chat and retry; stale threads will be pruned automatically.
- If needed, restart bridge and re-pair to refresh local session state.

## Development Commands

From repo root:

- `pnpm dev:bridge`
- `pnpm dev:mobile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Monorepo Layout

- `apps/mobile` - Expo app
- `apps/bridge` - Node bridge that tunnels WebSocket <-> stdio JSONL
- `packages/protocol` - Shared protocol/client/reducer code
- `docs` - architecture, decisions, UX, learnings
