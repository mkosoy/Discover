# Elsewhere product architecture and launch strategy

## Product direction

Elsewhere is a cinematic live documentary interface, not a dashboard. Earth remains the hero; evidence panels explain what is observed, what is corroborated, what is interpretation and what remains unknown.

Current principles:
- One focal object: a physically rotatable, zoomable Earth.
- Two flagship modes: Surprise/Watch and Beyond the Headlines.
- Every visible control should either change the scene or open a real evidence lens.
- Real-time claims must be traceable to public sources and retrieval times.
- Missing evidence is shown as an open question rather than filled with generic copy.
- Mobile is a first-class bottom-sheet experience.

## Current implementation

- Next.js 14, React 18, TypeScript, Vercel serverless API routes.
- Three.js/react-three-fiber Earth with NASA Blue Marble textures, atmosphere, markers, focus rings and evidence arcs.
- Client refreshes discovery and investigation data every 60 seconds without discarding arbitrary tapped-place cards.
- PWA manifest/icons are present; the iOS path is installable web first, then native value-add later.
- Keyless public feeds currently include: ISS position, NASA video embeds, USGS earthquakes, NASA EONET, NOAA ACE/GOES/SWPC, NOAA STAR satellite imagery, NWS active alerts/zone geometry, GDACS, Open-Meteo weather/marine/air quality, adsb.lol aggregate aircraft positions, UK Carbon Intensity, Launch Library 2, Google News RSS, OCHA FTS, HDX and UNHCR.
- Media behavior: live YouTube embeds are poster-first to avoid bot-wall/error-first rendering and improve mobile performance; satellite imagery is cache-busted by NOAA Last-Modified timestamps.

## Evidence-lens architecture

Explore Further buttons call `/api/context` with topic, coordinates, subject title and stable entity ids when available. Dedicated lenses exist for:
- solar wind/aurora coupling;
- launch schedule and pad weather;
- earthquake aftershock sequences;
- ISS visibility caveats;
- NWS alert timing, satellite context and impact evidence;
- GOES satellite imagery freshness and interpretation limits;
- GDACS exposure modeling and relief-data limits;
- EONET event timelines;
- marine waves/swell versus storm surge;
- city air quality;
- UK grid carbon-intensity history;
- night-light availability caveats;
- generic reverse-geocoded weather context.

Remaining lens-quality rule: do not add a chip unless it produces evidence specific to that topic or explicitly explains what evidence is unavailable and what would be needed next.

## Mobile and iOS path

### Web/PWA first
Mobile now uses a bottom-sheet evidence panel, compact media posters, safe-area-aware controls and a hidden hero while the panel is open. Continue tuning:
- panel height and scroll affordance;
- globe legibility behind the sheet;
- touch target size;
- reduced-motion and low-power fallbacks.

### Native iOS strategy
Do not submit a thin web wrapper. A credible iOS app needs native value:
1. Validate the PWA and product loop first.
2. Use Capacitor or SwiftUI/WebView only after web quality is proven.
3. Add push notifications for major events, native share, haptics, widgets/live activities, offline saved investigations and background refresh.
4. Prepare Apple Developer account, bundle id, privacy labels, screenshots, age rating, review notes and device testing.

## Deployment state

Production exists at https://elsewhere-discover-nine.vercel.app, but Vercel free deployment quota has been exhausted (`api-deployments-free-per-day`). Latest validated work is in PR #1 and may be ahead of production. Continue local production builds and batch commits; do not burn deploy quota or rely on PR CI until quota resets/plan changes.

## Immediate priorities

1. Keep improving evidence density and visual specificity rather than adding generic cards.
2. Add shareable deep links for moments/evidence paths.
3. Add diversity/no-repeat scoring to Surprise and Watch.
4. Improve globe marker affordance, labels and tapped-place detail.
5. Test real device mobile behavior, especially embeds and WebGL performance.
6. Expand investigations only where they produce comparison, corroboration or attention-gap insight.
