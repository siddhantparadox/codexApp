# Overview

## Product scope
Codex Mobile is an Expo-based mobile client that controls a local Codex runtime through a laptop bridge.

V1 supports:
- Home LAN connections.
- Remote connections through Tailscale (computer must remain on).
- Chat + thread history + streamed activity + approvals.
- Account + rate-limit visibility from App Server.

## Monorepo layout
- `apps/mobile`: Expo React Native app for onboarding, connection management, thread drawer, chat timeline, and approval actions.
- `apps/bridge`: Node bridge process that spawns `codex app-server` and relays stdio JSONL over WebSocket.
- `packages/protocol`: Shared JSON-RPC/client/reducer logic used by both apps.

## Runtime architecture
1. `apps/bridge` spawns `codex app-server` as a child process.
2. Bridge reads JSONL lines from stdout and forwards them to authenticated mobile WebSocket clients.
3. Mobile sends JSON-RPC messages (`initialize`, `thread/*`, `turn/*`, approval responses) through WebSocket.
4. Bridge writes each message to app-server stdin as JSONL.
5. Bridge emits `bridge/error` notifications when process startup or stdin forwarding fails, so mobile can surface failures immediately.

## Protocol notes (Codex App Server)
Implemented against OpenAI Codex App Server docs:
- Initialize with `initialize` then `initialized`.
- Start/resume/list/read threads with `thread/*`.
- Fork threads with `thread/fork`.
- Start/interrupt turns with `turn/*`.
- Stream and reduce `item/*`, `turn/diff/updated`, and `turn/plan/updated` notifications.
- Handle item delta events (`item/plan/delta`, reasoning summary deltas) for live plan/reasoning updates.
- Handle server-initiated approval requests for command execution and file changes.
- Read account state with `account/read` and `account/rateLimits/read`.

## UI/UX direction
The mobile UI follows `uiux.md` + stitch screenshots:
- Chat-first screen with minimal top bar.
- Left drawer for thread history and navigation actions.
- Mobile history defaults to `appServer` thread sources to avoid stale cross-client rollout records from other source kinds.
- Inline cards for tool activity, diffs, plans, and approvals.
- First-run onboarding with QR scan and manual connection fallback.
- Composer with run state, stop action, and quick actions sheet.
- Dark palette with teal accent and low-noise surfaces.

## Validation workflow
Workspace tasks are orchestrated through Turborepo:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Root scripts only delegate to `turbo run`.
