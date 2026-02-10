# Mistakes

## 2026-02-09
- Initial attempts to write large files in one command on Windows hit command-length/tool limits.
- Root cause: oversized single-command payloads.
- Remediation: write large files in smaller chunks and keep components modular.
- Prevention rule: for files above a few hundred lines, split writes or use incremental edits.
- Initial reducer update logic spread partial item payloads across union item types and risked invalid state merges.
- Root cause: treating every `item/started` and `item/completed` payload as fully compatible object patches.
- Remediation: merge only when runtime item types match; otherwise replace with the incoming typed payload.
- Prevention rule: for discriminated unions, enforce type guard checks before object spread merges.
- Connection bootstrap originally auto-opened the first listed thread; when that thread was stale (`missing rollout path`), this cascaded into repeated connect failures.
- Root cause: implicit assumption that all listed threads are resumable/readable.
- Remediation: connect without eager hydration, detect stale-thread errors, remove invalid threads locally, and retry turn on a fresh thread.
- Prevention rule: treat persisted thread catalogs as eventually consistent; all resume/read operations must be guarded and recoverable.
