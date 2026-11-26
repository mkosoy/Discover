# Elsewhere product architecture and launch strategy

## Product direction

Elsewhere should feel like a cinematic live documentary interface, not a dashboard. The first version is intentionally centered on one full-screen Earth, one primary action (`Surprise Me`), one calm evidence panel, and an autonomous `Watch` mode.

Creative principles:
- One focal object: Earth remains the hero at all times.
- Evidence is editorial, not analytic clutter: observed facts, reports, interpretations and open questions are visually distinct.
- Motion communicates travel and attention; UI should never feel busy.
- Every factual statement needs a source or an explicit uncertainty label.
- Mobile is a first-class consumer surface, not a shrunk desktop page.

## Current implementation

- Next.js 14, React 18, TypeScript, Vercel-ready.
- Three.js/react-three-fiber custom Earth with NASA Blue Marble imagery, atmosphere, stars and location markers.
- Serverless API routes aggregate keyless public sources and degrade gracefully.
- Current discovery sources: Where the ISS at?, USGS, NASA EONET, NOAA SWPC, NOAA CO-OPS, Open-Meteo and Launch Library 2.
- Current investigative sources: USGS, ReliefWeb, GDELT and NASA EONET.
- No credentials are required for the current version.

## Near-term creative ideas

1. **Watch mode as an AI-directed channel:** automatic cinematic transitions, changing narration density and themed sequences (Space, Wild Earth, Human Systems).
2. **Moment quality scoring:** rank discoveries by rarity, visual appeal, freshness, geographic diversity and evidence quality; avoid repeating the same template.
3. **Ripple lines:** animated arcs showing relationships between events, affected places and supporting observations.
4. **Time Machine scrubber:** replay earthquake sequences, storm evolution, launch windows and orbital passes.
5. **City awake/asleep layer:** day-night terminator, local time, transit pulses and dawn/dusk moments.
6. **Evidence confidence language:** compact plain-English labels instead of technical provenance jargon.
7. **Serendipity constraints:** avoid showing the same continent/template repeatedly unless it is genuinely exceptional.
8. **Shareable moments:** deep links that restore the same globe position, evidence panel and timestamped observation.

## Mobile and iOS path

### Web/PWA first
The Vercel web app should remain the fastest iteration surface. Mobile web UX requirements:
- bottom-sheet evidence panel rather than desktop side panel;
- large touch targets and one-thumb Surprise/Watch controls;
- no hover-dependent interactions;
- reduced clutter and collapsible evidence;
- fast first paint and graceful WebGL fallback.

### iOS strategy
The fastest credible App Store route is a native shell around the same product, not a separate codebase:
1. Validate the responsive web experience and product value.
2. Add PWA polish: app icon, splash screens, offline shell and install metadata.
3. Evaluate Capacitor versus a small SwiftUI/WebView wrapper. Capacitor is likely faster; SwiftUI may feel more native.
4. Native iOS additions that justify App Store distribution: push notifications for followed events, native share sheets, haptics, widgets/live activities, background refresh for major investigations and offline reading.
5. Do not submit a thin wrapper without native value; Apple may reject it as a repackaged website.
6. App Store preparation later requires Apple Developer account, bundle id, privacy nutrition labels, icons/screenshots, age rating, review notes and device testing.

## Vercel path

The repo is Vercel-ready (`vercel.json`, Next.js framework). Deployment still requires either connecting the GitHub repo in Vercel or a valid Vercel token. Do not purchase anything; use the existing free/hobby path if available.

## Immediate technical priorities

1. Visual iteration from real screenshots at mobile and desktop sizes.
2. Evidence panel density reduction and better mobile sheet behavior.
3. More diverse real discovery templates using keyless APIs.
4. Deterministic scoring/diversity logic for Surprise Me.
5. WebGL performance/idle behavior and low-power fallback.
6. Playwright smoke tests for API health, mobile layout, Surprise interaction and investigate mode.
