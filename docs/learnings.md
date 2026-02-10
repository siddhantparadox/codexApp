# Learnings

## 2026-02-09
- Codex App Server integration is simpler when bridge behaves as a transport adapter, not a custom API server.
- App-server approval flows are server-initiated requests; mobile must be able to answer JSON-RPC requests, not only notifications.
- Keeping protocol + reducers in a shared package reduced duplicate logic and test burden.
- Reasoning and plan updates can arrive as incremental deltas; reducers should append/patch by item id instead of replacing full objects.
- For Tailscale mode, preferring `100.x` interface addresses in pairing payloads reduces failed remote connections.
- Account and rate-limit reads should be best-effort (fail-soft) so chat remains usable if those endpoints are temporarily unavailable.
- Some local Codex state databases can reference stale rollout thread paths; mobile should tolerate this and recover instead of hard failing connection.
- Restricting mobile thread listing to `sourceKinds: [\"appServer\"]` reduces stale-thread noise from external client histories.
