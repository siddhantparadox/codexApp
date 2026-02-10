# UX

## Information architecture
- Primary surface: chat timeline.
- Secondary surface: collapsible drawer for thread history and connection/settings entry points.

## Visual system
- Background: `#0B0F14`
- Surface 1: `#111823`
- Surface 2: `#16202C`
- Border: `#243245`
- Text primary: `#E8EEF5`
- Text secondary: `#9FB0C3`
- Accent: `#2EC4B6`

## Component patterns
- User messages: right-aligned accent bubbles.
- Assistant output: left-aligned cards/text.
- Tool activity + file changes + plans: compact dark cards in timeline.
- Approval requests: inline cards with `Allow` and `Deny` actions.

## Mobile behavior
- Drawer overlays content on phones.
- Composer stays pinned at bottom with running status indicator.
- Connection onboarding supports QR scanning and manual fallback.
