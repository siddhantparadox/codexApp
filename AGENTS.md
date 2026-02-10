# AGENTS.md

This repository builds **Codex Mobile**:
- **Mobile app**: Expo (React Native) client (Android-first UX; iOS later).
- **Computer bridge**: minimal local service that spawns `codex app-server` and tunnels the protocol to the phone.
- **V1 networking**:
  - **Home LAN** (same Wi‑Fi) is supported.
  - **Remote-from-anywhere via Tailscale** is supported (phone can be off-LAN) **as long as the computer is ON**.
- **Computer must be ON** to run Codex against local repos/workspaces.

You are an implementation agent working in this repo. Follow the rules below.

---

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Patterns you establish will be copied.  
Corners you cut will be cut again.  
Fight entropy. Leave the codebase better than you found it.

---

## Summary

Read architecture/style guides. Write/run tests. Check lint/types. Hardcore code review.

---

## Monorepo and Build System

- Use a **PNPM workspace + Turborepo** monorepo.
- Keep shared logic in `packages/*` and app/runtime code in `apps/*`.
- Use Turborepo for task orchestration (`lint`, `typecheck`, `test`, `build`, and scoped dev tasks).
- Do not introduce a second orchestration layer (Nx/Lerna/custom task runners) for v1.

---

## Required implementation workflow (for all implementations)

> Not for research or Q&A. For any actual coding/change work, you MUST do these steps.

### Plan
- Create a solid, high quality architecture plan (brief but concrete).
- Read `repo-root/docs/overview.md` **if it exists**.
  - If it does not exist and your change is non-trivial, create it (or update it) with the minimum needed context.

### Implement
- Implement incrementally.
- Ensure you write tests for whatever you implement.
  - Focus on: happy paths, common edge cases, and core logic.

### Validate
- Run the linter.
- Run the type checker.
- Run tests.

If you cannot run any of these (CI/down env), explain exactly why and provide best-effort alternatives.

---

## Setup commands (run these first)

### Prereqs
- Node.js **20+** recommended.
- PNPM recommended:
  - `corepack enable`

### Install
- `pnpm install`
- `pnpm turbo run build` (when build scripts exist)

### Run (development)
- Start the bridge (spawns `codex app-server`, exposes WebSocket server):
  - `pnpm dev:bridge`
- Start the mobile app (Expo dev server):
  - `pnpm dev:mobile`
- Launch Android:
  - `pnpm --filter @codex-remote/mobile android`
  - (or) `pnpm --filter @codex-remote/mobile start` then press `a`

### Quality checks (MUST run before finishing)
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test`

If scripts are missing, create them in the root `package.json` and ensure they work through Turborepo pipelines.

---

## Repository layout (expected)

- `apps/`
  - `mobile/` — Expo app
  - `bridge/` — Node.js bridge (CLI)
- `packages/`
  - `protocol/` — shared TS types/helpers (message framing, ids, reducers)
- `docs/`
  - `overview.md` — architecture & decisions (required as the repo grows)
  - `decisions.md` — ADR-style decisions (navigation/state libs, protocol envelope, etc.)
  - `learnings.md` — dated implementation learnings and implications
  - `mistakes.md` — mistakes, root causes, remediations, and prevention rules
  - `best-practices.md` — evolving engineering and product implementation standards
  - `ux.md` — UI structure and design rules
  - `remote-access.md` — Tailscale instructions & troubleshooting
- `AGENTS.md` — this file

Add nested `AGENTS.md` files in subfolders only when you need narrower rules.

---
## Bugs
Bugs: add regression test when it fits.

## Documentation
- Browse web to reference any other documentation that might be useful if you are unsure about something.
- Use the internet to find any other information that might be useful.
- Keep `docs/overview.md` aligned with the current implementation state.
- Add/update entries in `docs/learnings.md`, `docs/mistakes.md`, and `docs/best-practices.md` during implementation work, not only at release time.

## Agent Skills
- use /rams to see real-time design feedback in your AI coding agent.
  1. curl -fsSL https://rams.ai/install | bash
  2. /rams
  3. If failed to use /rams, remove it from AGENTS.md file.
- Use appropriate skills from .agents/skills when needed to code using best practices.
- Use the Turborepo skill at `.agents/skills/turborepo/SKILL.md` for workspace, pipeline, caching, and task-graph changes.
- If a repo uses `.agent/skills` in another branch or machine setup, check that path as a fallback.

## MCPs
- Use `openaiDeveloperDocs` MCP server to browse relevant openai developer documentation like Codex and codex app server and any thinge else required.

## Remember this file AGENTS.md is a growing and evolving file so make sure to update it with important information as we build the app like learnings, mistakes, best practices, and other important information.

## Implementation notes (2026-02-09)
- Monorepo now uses PNPM workspace + Turborepo with apps/mobile, apps/bridge, packages/protocol.
- Bridge uses WebSocket token auth and forwards JSON-RPC messages to codex app-server stdio JSONL without protocol rewriting.
- Bridge pairing host resolution prefers Tailscale `100.x` addresses when running in `tailscale` mode.
- Mobile UI follows chat-first + drawer layout from uiux.md and stitch screens, with inline approvals and timeline cards.
- Shared protocol/client/reducer logic lives in packages/protocol and should remain the single source of truth for Codex message handling.
- Protocol coverage includes account + rate-limit reads and item delta handling for plan/reasoning updates.
- Mobile connection flow now guards against stale Codex rollout threads (`missing rollout path`) by avoiding eager hydration, pruning invalid threads, and retrying turns on fresh threads.

