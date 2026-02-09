* **Codex App Server is a local, long‑running process** that speaks a **bidirectional JSON‑RPC protocol over JSONL on stdio** (stdin/stdout). ([developers.openai.com][1])
* So your phone can’t talk to it “directly over the network” — you’ll use a **bridge on the laptop/workspace** that:

  1. spawns/owns `codex app-server`
  2. converts **WebSocket/HTTP ⇄ stdio JSONL**
  3. handles pairing/auth (QR) and security.

That bridge + QR pairing is exactly the right approach.

Below is a practical breakdown of **what you can ship in the app**, starting with a clean MVP that really runs the agent from the phone, then expanding into “full capabilities.”

---

## What Codex App Server gives your app (capabilities you can surface)

Codex App Server is what powers “rich clients” (like the VS Code extension) and is meant for deep integrations: **thread history, approvals, auth/account state, and streamed agent events**. ([developers.openai.com][1])

Core concepts you’ll build UI around: ([developers.openai.com][1])

* **Thread** = a conversation
* **Turn** = one user request + the work the agent does
* **Item** = a unit inside a turn (messages, command runs, file changes, diffs, etc.)

The good news: this maps perfectly to a mobile UI timeline.

---

## Your architecture (recommended)

### Laptop/workspace side

**Bridge (your code)**

* Runs a small server (HTTP + WebSocket)
* Spawns `codex app-server` as a child process
* Relays:

  * phone → bridge → app-server stdin (JSONL)
  * app-server stdout → bridge → phone (events + replies)

**Codex App Server**

* Reads JSONL JSON-RPC messages from stdin
* Streams notifications/events on stdout ([developers.openai.com][1])

### Android/Expo side (your app)

* Scans QR code
* Opens WebSocket to the bridge
* Sends JSON‑RPC messages (initialize, thread/start, turn/start, approval decisions, etc.)
* Renders streaming events into a chat/timeline UI

---

## Connection methods you want (LAN + Tailscale)

### Method 1: Same network

* Bridge listens on laptop LAN interface (e.g. `http://192.168.1.10:PORT`)
* QR contains that base URL + pairing token
* Phone connects over Wi‑Fi

**Practical tip for Expo/Android:** if you use plain `http://` you may need to allow cleartext traffic on Android depending on build config. For production, consider HTTPS even on LAN (self-signed + cert pinning / fingerprint in QR).

### Method 2: Tailscale

* Laptop + phone both join same tailnet
* Bridge binds to the Tailscale interface or all interfaces
* QR contains the laptop’s **Tailscale IP (100.x)** or **MagicDNS hostname**
* Phone connects from anywhere

Tailscale gives you encryption + stable connectivity, but you still need **application-layer auth** (pairing token etc.) because “being on the tailnet” shouldn’t automatically mean “can run commands in my repo.”

---

## Pairing UX: QR bridge flow (a solid, safe MVP)

### Laptop: “Bridge Pairing Screen”

Show a QR code that encodes something like:

```json
{
  "v": 1,
  "name": "My Laptop",
  "mode": "lan",
  "baseUrl": "ws://192.168.1.10:8787/ws",
  "pairingToken": "one-time-secret",
  "serverPubKeyFingerprint": "sha256:....",
  "expiresAt": 1739999999
}
```

### Phone: “Scan & Connect”

* Scan QR
* Save connection profile (SecureStore/Keychain)
* Connect WebSocket with `Authorization: Bearer pairingToken`
* Bridge validates token + optionally fingerprints (TOFU)

### Why fingerprint?

Because LAN can be MITM’d; QR scanning is your chance to bind the app to the right server.

---

## The absolute basics you should build first (true MVP)

Your MVP goal: **From the phone, start a thread, send a prompt, watch streaming progress, and handle approvals.**

### MVP capability checklist

#### 1) Connect + initialize handshake

App Server requires:

* `initialize` request with client metadata
* then `initialized` notification
  Server rejects requests before that handshake. ([developers.openai.com][1])

So on WebSocket connect, your phone should immediately send:

* `initialize` (with `clientInfo`)
* `initialized`

#### 2) Start (or resume) a thread

* `thread/start` for new conversation
* `thread/resume` to continue an existing one ([developers.openai.com][1])

This unlocks:

* conversation history UI via `thread/list` and `thread/read` ([developers.openai.com][1])

#### 3) Start a turn (send the user prompt)

Use `turn/start` with an input list:

Example (simple):

```json
{ "method": "turn/start", "id": 30, "params": {
  "threadId": "thr_123",
  "input": [{ "type": "text", "text": "Run tests and fix failures." }]
}}
```

You can also pass important controls per turn: `cwd`, `approvalPolicy`, `sandboxPolicy`, `model`, `effort`, etc. ([developers.openai.com][1])

#### 4) Stream the agent’s work in real time

You’ll render a timeline from notifications like:

* `turn/started`, `turn/completed`
* `item/*` notifications, including deltas for agent messages and command output ([developers.openai.com][1])

This is the heart of the UX: the phone should feel like a “Codex client,” not a dumb remote terminal.

#### 5) Handle approvals (critical for “full capabilities”)

Depending on user settings, Codex may require approvals for:

* command execution
* file changes

App Server sends **server-initiated JSON-RPC requests** that your client must answer with `{ decision: "accept" | "decline" }` (and sometimes `acceptSettings`). ([developers.openai.com][1])

Your mobile app must have a clean “Approval sheet” UI:

* show command + cwd + risk/reason if present
* accept / decline
* (optional) “always allow this command pattern” if you support `acceptSettings`

If you skip approvals, you’ll constantly “stall” turns and users will think it’s broken.

---

## What screens/features you can have in the app (MVP → Full)

### MVP screens (get these perfect)

1. **Connections**

   * scan QR
   * list saved machines/workspaces
   * connect/disconnect
   * show connection mode: LAN / Tailscale

2. **Threads (History)**

   * list threads via `thread/list` (pagination) ([developers.openai.com][1])
   * open thread
   * resume thread

3. **Conversation / Turn Timeline**

   * message composer
   * start turn
   * streaming events
   * “stop” / “interrupt” if you add it later (depends on protocol support; start with read-only streaming + approvals)

4. **Approvals Inbox**

   * shows pending approvals
   * tap to review + decide ([developers.openai.com][1])

### “Full capability” screens (very doable once MVP works)

5. **Diff Viewer**

   * render `turn/diff/updated` unified diff (great mobile UX: collapsible files) ([developers.openai.com][1])
   * tie into file-change approvals (show proposed patch before accepting)

6. **Plan View**

   * render `turn/plan/updated` steps with statuses (pending / inProgress / completed) ([developers.openai.com][1])

7. **Quick Actions**

   * “Run tests”
   * “Lint”
   * “Explain failing CI”
   * Under the hood: either `turn/start` with preset prompt, or `command/exec` for a direct command ([developers.openai.com][1])

8. **Account / Rate Limits**

   * show auth mode and plan type with `account/read`
   * show rate limits with `account/rateLimits/read` ([developers.openai.com][1])

Practical reality: the ChatGPT browser login flow in App Server uses a localhost callback (`redirect_uri=http://localhost:<port>/auth/callback`), which is easiest to complete on the machine running the server. ([developers.openai.com][1])
So for your mobile client, the simplest product choice is:

* “Login happens on the laptop once; mobile is a controller.”

9. **Workspace Controls**

   * choose `cwd` / workspace roots per thread/turn
   * show current sandbox / network access mode in UI
   * allow toggling *only if user explicitly enables it* ([developers.openai.com][1])

---

## Security and trust (don’t skip this)

Codex is explicitly designed with sandboxing and approvals:

* by default, **network access is off**
* local operation uses an **OS-enforced sandbox**
* approvals can be required for commands and file changes ([developers.openai.com][2])

Your app should reinforce that model:

* Always show when a turn is about to run commands / change files
* Don’t hide the approvals UX
* Provide a big, obvious “Disconnect / Revoke pairing” action

Bridge-side hardening ideas:

* One-time pairing tokens + short expiry
* Separate “read-only” vs “control” tokens
* Restrict which interfaces the bridge listens on (LAN only / Tailscale only)
* Optional IP allowlists (e.g., only tailnet subnet)
* Log all approvals + actions locally

---

## Implementation notes (Expo-friendly)

### Transport

* Use **WebSocket** for “stdio-like” bidirectional streaming
* Your bridge can forward each JSONL line as one WS message

### Message routing

On the phone:

* Maintain a map of `id → pending request resolver`
* Treat notifications (no `id`) as events for your state store

### Type safety

Codex lets you generate schemas:

* `codex app-server generate-ts --out ./schemas`
* `codex app-server generate-json-schema --out ./schemas` ([developers.openai.com][1])

This is huge: you can generate TypeScript types and keep your mobile client aligned with the exact Codex version your bridge ships.

---

## A clean product roadmap (so you don’t get stuck)

### Phase 1 (MVP “it works”)

* QR connect
* initialize handshake
* thread/start, turn/start
* stream agent text + command output
* handle approvals

### Phase 2 (Feels like a real Codex client)

* thread/list + thread/read history UI
* diff view (`turn/diff/updated`)
* plan view (`turn/plan/updated`)

### Phase 3 (Power user)

* multi-workspace profiles
* push notifications when approvals needed / turn completed
* “quick actions” library
* basic settings: sandbox/network/approval policy presets per workspace

---

## One last recommendation: keep the bridge minimal, but “Codex-correct”

Because App Server is **stdio JSONL JSON-RPC** ([developers.openai.com][1]), your bridge should behave like a very thin transport adapter:

* don’t invent a totally new API if you can avoid it
* forward messages mostly unchanged
* only add:

  * auth headers / token validation
  * connection multiplexing (optional)
  * observability/logging

This way your mobile client is basically “a real Codex client,” and you automatically inherit new capabilities as App Server evolves.

---