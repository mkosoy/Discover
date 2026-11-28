# Elsewhere — state of the product (Nov 26, 2026)

## What it is
A live discovery platform for Earth: real-time public data, interactive 3D globe, 459 live public cameras across 122 countries, satellite imagery, and autonomous cross-source investigations. Tagline: Discover what's happening. Understand what it means.

## Numbers right now
- 32 live discovery cards generated per refresh cycle (60s polling)
- 11 concurrent investigations in the rail, each multi-source
- 459 deduplicated public cameras — 302 video-backed, 145+ refreshing still imagery — across 122 independent countries (honest ceiling documented; remaining countries lack keyless embeddable streams)
- ~2,600 live aircraft rendered as a globe shimmer layer (stride-sampled from 5,000-15,000 depending on time of day)
- 0 console errors in full-loop validation (desktop + mobile)

## The investigations (the differentiator)
1. **The attention gap** — coverage-per-million-displaced across Ukraine/Sudan/Myanmar/Haiti/DRC/Yemen, same-hour measurement
2. **The empty-sky audit** — live ADS-B sampling: conflict-zone skies silent vs 250-340 aircraft in control skies
3. **The planet's emergency board** — the whole GDACS board (~156 active modeled hazards), ranked by impact not attention
4. **The air divide** — same-hour PM2.5 across 16 megacities; ratio recomputes itself hourly (33x → 47x observed)
5. **24 volcanoes actively erupting** — Smithsonian/USGS consensus feed, linked to live volcano cameras
6. **Seismic energy audit** — full USGS week catalog, energy concentration math
7. **Space weather** — live solar wind + K-index + aurora boundary calculation
8. **Orbital cadence** — launch frequency analysis
9. **Ukraine: a silent sky** — multi-source wartime synthesis, non-tactical
10. **Sudan attention gap** — displacement vs coverage
11. Plus seismic-ripple and event-attention-gap explainers

## Signature live moments
- ISS crossing the planet with live TLE-propagated orbital track
- Earth photographed whole from a million miles away (NASA DSCOVR, ~2h cadence)
- Dawn breaking over megacities — computed fresh every minute from pure astronomy
- 15,000 aircraft airborne census with estimated souls aloft
- Aurora composite verdict: Kp + darkness + cloud at the Lapland camera, honestly labeled
- Mount Etna venting on live camera (resolves even from stale shared links)

## Architecture honesty
- Every card labels evidence: observed / verified / interpretation / question
- Freshness is honest: "positions ~40s old", model vs measurement distinguished
- No fabricated observations; absent data says so
- Night-aware cameras: aurora boosted after dark, nature cams honestly say "expect darkness"

## Infrastructure
- Next.js 14 App Router on Vercel (hobby quota exhausted — resets ~16:00 PT Nov 27)
- Zero API keys required — every feed is keyless public data
- In-process caching: investigations stale-while-revalidate, ADS-B throttle-respecting
- Share links: ?d=<id> query params with server-resolved dynamic OG metadata
- Local watchdog keeps preview servers alive

## Known gaps / next moves
- Vercel deploy blocked by hobby quota until ~16:00 PT Nov 27 (or plan upgrade)
- iOS: PWA installable today; Capacitor wrapper strategy in docs/ios-strategy.md — needs Apple Developer $99/yr decision
- OG images are per-discovery imagery but not composited/branded cards
- Remaining ~70 countries lack keyless embeddable cameras (documented, not faked)
- EONET fire cards could cross-reference air quality more deeply
