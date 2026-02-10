# Remote Access (Tailscale)

## Goal
Allow phone-to-computer Codex control when devices are off-LAN.

## Steps
1. Install Tailscale on the computer and phone.
2. Join both devices to the same tailnet.
3. Start bridge on computer: `pnpm dev:bridge`.
4. Use bridge pairing payload/QR where `baseUrl` points at the machine Tailscale address or MagicDNS host.
5. Connect from mobile.

## Security guidance
- Keep pairing token required even on tailnet.
- Rotate pairing tokens if device access changes.
- Revoke stale saved connections in the mobile app.

## Troubleshooting
- If connection fails, verify bridge is listening and computer is online.
- Confirm Tailscale connectivity by pinging tailnet address from the phone network context.
- Ensure firewall allows bridge port on Tailscale interface.
