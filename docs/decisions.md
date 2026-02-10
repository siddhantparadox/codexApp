# Decisions

## ADR-001: Bridge transport is WebSocket over JSON payloads
- Date: 2026-02-09
- Decision: Mobile and bridge communicate over authenticated WebSocket. Bridge forwards payloads to app-server stdin/stdout JSONL unchanged.
- Rationale: Keeps bridge thin and protocol-compatible with Codex App Server evolution.

## ADR-002: Pairing is token-based with QR payload
- Date: 2026-02-09
- Decision: Bridge emits pairing payload containing `baseUrl`, `pairingToken`, and expiry. Mobile stores this profile and reconnects with token in query.
- Rationale: Fast setup for LAN/Tailscale while enforcing application-layer access control.

## ADR-003: Shared protocol package
- Date: 2026-02-09
- Decision: JSON-RPC client behavior and event reducers live in `packages/protocol`.
- Rationale: One source of truth for message handling across bridge and mobile.

## ADR-004: Chat timeline is source-of-truth UI model
- Date: 2026-02-09
- Decision: Item lifecycle and deltas are reduced into per-thread timeline state; UI renders this state directly.
- Rationale: Matches Codex App Server event design and keeps mobile rendering deterministic.
