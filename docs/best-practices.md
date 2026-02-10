# Best Practices

- Keep bridge as a thin adapter to Codex App Server protocol messages.
- Treat `item/completed` as authoritative for item final state.
- Use per-thread reducer state for timeline rendering and avoid ad hoc message mutation.
- Keep approval actions inline in thread context so decisions are tied to active work.
- Persist connection profiles but never persist privileged secrets beyond minimum pairing data.
- Prefer workspace package scripts + Turborepo orchestration over root script logic.
- In Tailscale mode, advertise Tailscale addresses first (`100.x`) in QR payload generation.
- Handle account and rate-limit endpoints as optional UX enrichments, not hard requirements for chat flow.
- Emit explicit bridge error notifications for spawn/write failures so mobile can surface actionable states.
- Model App Server item deltas (`plan`, `reasoning`) as first-class reducer updates instead of polling thread snapshots.
- Do not auto-assume `thread/list` entries are readable/resumable; lazy-open threads and degrade gracefully when stale local rollout data exists.
- If `turn/start` fails with stale-thread errors, remove the invalid thread from local list and retry once on a new thread.
