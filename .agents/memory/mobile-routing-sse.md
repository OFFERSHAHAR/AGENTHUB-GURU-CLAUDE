---
name: Expo mobile typed routes & SSE
description: Non-obvious constraints when adding a new screen/route or live updates to the agent-hub-mobile Expo app
---

# Expo mobile: new routes & live updates

## Typed routes
- Adding a new route file (e.g. `app/triggers/[id].tsx`) does NOT make `router.push` typecheck pass until the Expo dev server regenerates `.expo/types`. Restart the mobile workflow once, then typecheck.
- Use the object form for dynamic routes: `router.push({ pathname: "/triggers/[id]", params: { id: String(x) } })`. The template-string form `` `/triggers/${x}` `` fails typed-routes checks.

## Live updates (SSE) on mobile
- React Native native has NO `EventSource`; it only exists on RN Web. The shared web `useTriggerStream` (global `/api/trigger/stream`) is mirrored in mobile `hooks/useTriggerStream.ts` but is a no-op on native.
- **Why:** so the live contract still holds — per-card react-query polling (fast while triggered/running, slower from idle so external fires are caught) is the cross-platform fallback, same pattern the web dashboard keeps.

## Misc
- Mobile base URL for raw fetch/EventSource: `https://${process.env.EXPO_PUBLIC_DOMAIN}` (same value `setBaseUrl` uses in `app/_layout.tsx`).
- Clipboard on mobile = `expo-clipboard` (`Clipboard.setStringAsync`); works on web + native without Platform checks.
