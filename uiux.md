## 1) App structure: one primary screen + one drawer

### Navigation (keep it minimal)

* **Main screen:** `Chat`
* **Left collapsible sidebar (drawer):** `Threads`
* **One modal sheet:** `Connection / Workspace` (only when needed)
* **Optional** (later): `Settings` screen inside the drawer footer

✅ Avoid bottom tabs. Your screenshots use tabs, but the ChatGPT feel comes from “chat + sidebar”.

---

## 2) Layout blueprint (ChatGPT-like)

### A) Main Chat Screen (default)

**Top App Bar (48–56dp)**

* Left: **☰** (opens drawer)
* Center: **Workspace name** (e.g., `MyRepo`) + small subtitle `branch` (e.g., `main`)
* Right: **connection dot** (green/gray) + **⋯** (actions)

**Message Timeline (full height)**

* “Chat feed” with:

  * user messages
  * assistant messages
  * collapsed “tool activity” cards
  * approvals (inline)

**Composer Bar (pinned bottom)**

* Left: **＋** (attachments / quick actions)
* Center: multiline input (“Ask Codex…”)
* Right: send button (paper plane)
* While running: send becomes **Stop** (square)

**Everything happens in chat.** No switching screens to see logs/diffs; they’re cards inside the chat.

---

### B) Left Drawer = Threads + Workspace

This should match ChatGPT’s mental model.

**Drawer header**

* Title: `Codex`
* Small status row:

  * Connection indicator (dot + “Connected / Offline”)
  * Workspace selector pill (tap opens sheet)

**Primary actions**

* **New chat** (full-width button)
* Search field (threads)

**Thread list**

* Grouped by date:

  * Today
  * Yesterday
  * Previous 7 days
  * Older
* Each row:

  * Thread title (1 line)
  * Tiny subtitle: repo/branch or last activity timestamp
  * Optional badge:

    * “Running” (tiny spinner)
    * “Needs approval” (small dot)

**Drawer footer**

* `Connections`
* `Settings`
* `Help`
* `Disconnect`

> Minimal rule: drawer is only for threads and basic management.

---

## 3) Visual style (minimal, modern, “ChatGPT-ish”)

You said “NO themes nothing” — interpret that as:

* **No theme picker**
* Either:

  * **follow system light/dark automatically**, or
  * ship **one default dark style** only
    (Your iOS screenshots are dark, and agent tools look better on dark.)

### Recommended visual language

* Background: near-black (not pure black)
* Surfaces: slightly lighter panels for cards
* Borders: ultra-subtle (1px / 0.5px)
* Corners: 14–18 radius for cards, 999 for pills
* Typography: system font (Android default), strong hierarchy

### Aesthetic rules

* **No gradients**, no glass blur, no heavy shadows
* Use **spacing** and **typography** to feel premium
* One accent color only (used sparingly: send button, connection status, selected thread)

---

## 4) Chat timeline: message types (this is the heart)

Your “Codex runner” should behave like an assistant in ChatGPT. That means: **agent activity is shown as assistant timeline items**.

### Message types you need (minimal set)

#### 1) User message (right aligned bubble)

* Rounded rectangle
* Slightly different surface shade
* No avatar

#### 2) Assistant message (left, full-width or slight inset)

* Prefer **no bubble** (ChatGPT style), but allow a soft container for code blocks
* Markdown rendering:

  * headings
  * bullets
  * inline code
  * code blocks with copy button

#### 3) Tool activity (assistant “collapsed card”)

This replaces “terminal UI”. Keep it compact.

**Collapsed state (default):**

* Icon + label: `Tool activity`
* Subtitle: `5 commands • 0:14`
* One-line preview: `git status --short`
* Chevron to expand

**Expanded state:**

* List tool calls, each as a mini-row:

  * `> git status --short`
  * `> rg -n "something"`
* Each tool call row can expand to show output
* Include a **Copy output** button

✅ This maps closely to your screenshot where tool calls are listed, but in a more “ChatGPT card” style.

#### 4) Diff card (assistant card)

When codex updates diffs:

* Collapsed:

  * `Changes` + `+27 / -4` + `3 files`
* Expanded:

  * file list
  * tap file → opens **full-screen diff viewer** (modal)
* Add `Copy patch` button

#### 5) Plan card (assistant card)

When a plan is created:

* Collapsed: `Plan • 6 steps`
* Expanded: checklist steps, with live statuses:

  * ⏳ / ✅ / ▶️

#### 6) Approval request (inline assistant card)

Approvals should feel first-class and safe.

**Approval card content**

* Title: `Approval required`
* Summary: `Run command` or `Modify files`
* Details (tap to expand):

  * command, cwd, repo
  * risk note if any
* Buttons:

  * `Allow` (primary)
  * `Deny`
* Optional secondary action:

  * `Allow once` vs `Always allow for this repo` (later)

✅ Keep approvals *in-thread*, not a separate inbox. (You can add an inbox later if needed.)

---

## 5) Minimal top-bar actions (don’t clutter)

Top right `⋯` menu (only 4–6 items max):

* Rename thread
* Share transcript / copy link (optional)
* View run settings (model/effort/approval policy)
* Clear thread
* Open connection settings

That’s it.

---

## 6) Composer UX (simple, “ChatGPT”)

### Default composer state

* Placeholder: “Ask Codex to do something…”
* Multiline input grows up to ~5 lines
* Send button disabled until text exists

### While running

* Replace send with **Stop**
* Show tiny status above composer:

  * `Working… 0:12` (like your screenshot)
* If approvals needed, show a subtle banner:

  * `Waiting for approval`

### Attachments / quick actions (tap “＋”)

A bottom sheet with only:

* `Attach file path` (later)
* `Insert workspace context` (e.g., repo summary)
* `Run: tests` (preset prompt)
* `Run: lint` (preset prompt)

Keep it short. No giant command palette.

---

## 7) Connection UX (minimal, elegant onboarding)

### First-run screen (one screen only)

Title: `Connect your computer`
Two big options:

1. **Scan QR code** (primary)
2. **Enter details manually** (secondary)

Below: small text “Works on same Wi‑Fi or via Tailscale.”

### After scan

Show a “connection test” view:

* `Connecting…`
* If success: big `Connected` + button `Continue`
* If fail: show exact reason with one retry

**Do not put connection settings as a big form first** (like your screenshot). Make QR the default.

---

## 8) Responsive behavior (ChatGPT-like)

* **Phones:** drawer is overlay (swipe from left / hamburger)
* **Tablets / foldables:** persistent sidebar (split view)

  * left = threads
  * right = chat

This instantly makes it feel like a real “desktop companion”.

---

## 9) Wireframes (simple)

### Chat screen (phone)

```
┌─────────────────────────────────────┐
│ ☰  Workspace ▾   main        ●  ⋯   │
├─────────────────────────────────────┤
│                                     │
│  Assistant message…                 │
│                                     │
│                         User bubble │
│                                     │
│  Tool activity (collapsed)          │
│   5 commands • 0:14  > git status…  │
│                                     │
│  Diff (collapsed)  +27 / -4  3 files│
│                                     │
│  Approval required                  │
│   Run command: pnpm test            │
│   [Allow] [Deny]                    │
│                                     │
├─────────────────────────────────────┤
│ ＋  Ask Codex…                ➤/■   │
└─────────────────────────────────────┘
```

### Drawer (threads)

```
┌─────────────────────────────┐
│ Codex                   ●   │
│ [Workspace ▾]               │
│ [ + New chat ]              │
│ [ Search threads… ]         │
│                             │
│ Today                       │
│  • Fix build on Android     │
│  • Add QR pairing           │
│ Yesterday                   │
│  • Refactor bridge server   │
│                             │
│  Connections                │
│  Settings                   │
│  Disconnect                 │
└─────────────────────────────┘
```

---

## 10) What to copy from the iOS screenshots (and what to avoid)

### Keep (good inspirations)

* Inline “Working…” indicator
* Tool calls list (`git status`, `rg`, etc.)
* Copy buttons on code/output
* Compact status/branch in header

### Avoid (to stay minimal like ChatGPT)

* Too many tabs
* Large dashboard cards (usage snapshot)
* Heavy glass/gradient cards everywhere
* Complex controls always visible (plan/model/effort chips always shown)

Instead: hide advanced controls in a bottom sheet.

---

## 11) MVP UI checklist (build this first)

If you implement only these, the app will already feel premium:

* Drawer thread list (grouped by date)
* Chat timeline with:

  * user message
  * assistant markdown message
  * tool activity collapsed card
  * approvals inline card
* Simple QR connect flow
* Top bar with workspace/branch + connection dot
* Composer with Send/Stop

---