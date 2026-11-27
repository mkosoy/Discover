# Current product feedback and implementation state

## User feedback themes

- ISS/satellite-over-Earth is especially compelling.
- Mundane standalone facts such as a single tide reading are not compelling.
- Explore Further must be functional and evidence-specific.
- Visuals must be rich and live, not generic placeholders.
- Investigations must produce real multi-source insight, especially conflict-zone attention/humanitarian asymmetry, while remaining non-tactical.
- Globe must physically rotate/zoom and support tapping arbitrary places.
- Data should be real-time or minutes-old where possible.
- Clicking one event should reveal meaningful connections to other simultaneous world signals.
- Continue autonomously; optimize polish, smoothness, creativity and impressiveness.

## Implemented since the feedback

- Standalone SF tide card removed.
- Globe rotation/zoom/tap exploration implemented, including drag/click discrimination.
- Arbitrary tapped places produce reverse-geocoded weather, daylight, seismic and nearby-hazard evidence plus nearest concurrent signals.
- Connected-signal buttons and visual globe arcs implemented.
- Namibia and Tokyo live-camera cards use poster-first authorized YouTube embeds.
- GOES-East near-real-time imagery card added with Last-Modified freshness and cache-busting.
- NWS active-alert card added with zone geometry, exact alert identifiers, timing lenses and impact caveats.
- GDACS humanitarian hazard cards added with current-event filtering, impact imagery and exposure-model lenses. Significant earthquakes, NASA EONET events and NWS alerts now also carry latest-available MODIS satellite-swath context rather than generic motifs.
- Ukraine and Sudan investigations use conflict-filtered news attention, weather, OCHA FTS, HDX and UNHCR displacement data.
- Ukraine now includes a non-tactical live public-aircraft contrast: coarse ADS-B counts over a Ukraine-centered sample versus neighboring-country-centered samples, with receiver/coverage caveats and a visual comparison bar.
- Sudan includes attention-per-million-IDP normalization when samples are comparable; one-sided or capped samples are not visualized as false precision.
- ISS now includes a smooth propagated orbital track from the current public TLE, with orbit-model freshness shown as evidence.
- Ukraine now opens with NASA MODIS latest-available true-color satellite-swath imagery plus explicit non-surveillance caveats; attention cadence is visualized in 2h bins without claiming capped samples are total volume. Sudan, significant-earthquake and under-covered-event investigations also use latest-available MODIS visual context with explicit orbital/cloud/timing caveats.
- Mount Etna live-camera discovery added, with current wind/weather and volcano-specific ash/air-quality/seismic lenses.
## Camera coverage scaling (latest)

- Camera registry scaled to ~459 deduplicated public look-ins across 122 independent countries (~302 video-backed YouTube entries plus refreshing near-real-time still imagery from SkylineWebcams and Webcam Galore).
- Globe camera pins are interactive, mobile-tappable, color-coded by media type (teal video, gold imagery), with ranked nearest-camera selection and confidence/approximate-position labeling.
- Nearby-camera lens can supplement the curated registry with OpenEye's live public-camera index (200k+ indexed cameras) where rows are live, embeddable images.
- Webcam Galore integration adds precise-coordinate refreshing imagery for hard-to-cover countries: Egypt, Fiji, Liechtenstein, Montenegro, Papua New Guinea, Saint Vincent and the Grenadines, Tunisia.
- Honest coverage finding: the remaining ~70 uncovered independent countries largely lack keyless, embeddable, reliable public camera streams. YouWebcams/Webcamera24 deep links rely on embed.skydream.cam, whose DNS no longer resolves (defunct service), so those streams cannot be truthfully embedded. Filling gaps with unrelated cameras is deliberately avoided per product values.
- OpenEye probing of missing-country capitals found almost no coverage in those countries either (only Andorra and Antigua exact matches among 78 probed).

## Known camera limitations

- Generated YouTube live badges are point-in-time validations and can go stale.
- Some Skyline entries may serve a "latest image" rather than a truly live feed; labeling stays honest about "near-real-time imagery".
- Skyline HLS streams (livee.m3u8) remain unresolved; still-image fallback used instead.
- YouTube thumbnails may be static promotional images rather than live frames.

- Approximate sunlight/day-night lighting, duplicate-marker spreading, shortened NWS deep-link ids, compact evidence sections and no-immediate-repeat Surprise/Watch weighting improve polish.
- Share/deep links exist for discoveries, investigations and arbitrary tapped places, including truthful unavailable states when ephemeral live cards expire.
- Mobile bottom sheet compacted; hero hides while the evidence panel is open.
- Evidence lenses now cover satellite imagery, alert timing, exposure models, event timelines, marine conditions, air quality, grid history, launch weather, aftershocks, aurora visibility, volcano ash/seismic context and night-light caveats.
- “Nearby cameras” now ranks the nearest curated public YouTube look-ins by distance, shows up to three choices with poster-first embeds, and states distance/field-of-view caveats instead of generic camera prose. The registry contains 45 validated keyless public camera feeds across cities, harbors, volcanoes, wildlife, aurora and deserts.
- “Historical comparison” now uses Open-Meteo archive data for ordinary places/events: current weather is compared with the same date/hour one year earlier, with explicit one-year/climate-normal caveats; the UK carbon-grid comparison remains grid-specific.
- Fire/natural-event cards now cross-reference wind transport, modeled PM2.5/AOD smoke proxy, satellite context and nearest live look-in. Arbitrary place taps now compute a distinctive local evidence hook and expose nearby-camera/history actions directly.
- Fourteen featured live-look-in cards join Tokyo/Namib/Etna, including Times Square, Washington, Kīlauea, Iceland, Sydney, Vancouver, wildlife waterholes, aurora and harbor/city scenes; production API validation returned 29 discoveries, 17 with real video embeds.
- US events/places now prefer minutes-old NOAA GOES GeoColor sector imagery where coverage exists, falling back to NASA MODIS outside those sectors; media tags distinguish near-real-time imagery from latest swaths.
- The camera layer is now a generated global registry rather than a small hand list: 45 curated exact cameras plus validated country/city candidates, exposed as small interactive globe pins. Generated positions are explicitly marked approximate and lower confidence; clearly mismatched search results are removed rather than treated as evidence.

- Earth now uses a NASA-style Black Marble night-light overlay with warm amplified city lights on the night side, plus color-coded markers distinguishing live look-ins, fire, ocean, storm, seismic and aurora signals.
- Initial loading no longer waits for slow investigations before rendering discoveries; investigation deep links resolve when their slower endpoint arrives. GDELT’s unreliable/rate-limited request is capped at 1.8s. Local cold-start smoke improved to about 2.39s for discoveries and 1.89s for investigations.

## Known gaps / next best improvements

1. Production is behind PR #1 until the Vercel deployment quota resets or the plan changes; current work is intentionally local-only.
2. Some generic lenses remain weaker than the dedicated lenses; keep replacing them with evidence-specific views. Camera coverage is still sparse outside curated locations, so distance caveats must remain prominent.
3. Surprise/Watch can still improve diversity scoring and avoid visually similar consecutive moments.
4. Globe labels are minimal; marker affordance and tap feedback can become more magical.
5. Investigations have their first visual comparisons but still need richer editorial presentation and more comparative evidence types.
6. Real mobile-device validation is still needed for embed behavior, panel scrolling, investigation rail usability and WebGL performance.

## Session state checkpoint

- Latest local commits (not pushed, local-only per user): `4aba9a7` Cache large NWS alert payload in memory; `9f95a5b` landscape orientation; `1e1f87f` mobile dock overlap fix; `a894c38` docs; `3ca6b0b` Webcam Galore countries.
- Validated in real desktop Chrome via CDP: globe/day-night/pins/ISS card render correctly on desktop and mobile widths. The earlier black-screen was a dev-server artifact: `npm run build` overwrites `.next` and breaks a running `next dev`; restart dev or rm -rf .next.
- Dev server: `next dev` port 3100. Production build passes (First Load ~393 kB). Vercel deploy still quota-blocked; do not push.
- Next best hill-climb items: Skyline offline-camera detection, deeper cross-signal linking, Beyond the Headlines depth, more real footage quality (YouTube poster freshness), iOS/native strategy.

## Session checkpoint — 2026-11-26 late (investigation depth phase)

Commits after `f386a43` (all local-only, unpushed):
- orbital-cadence + space-weather-now investigations, NOAA freshness sorting, LL memory cache (was uncommitted at prior checkpoint; committed since)
- `c32cf09` camera look-ins night-aware scoring + honest time-of-day framing (aurora cameras boosted at night, nature cameras demoted, city cameras fine anytime)
- `eeea8d4` air-divide-now investigation: same-hour PM2.5 across 16 major cities, worst-vs-best divide metric (Open-Meteo air quality API, keyless, batched multi-city fetch)
- `413a69f` investigation rail robustness: module-level memory carries last-good investigations (1h TTL) across transient upstream failures — rail never silently empties
- `fb168b8` liveLinks on investigations: volcano → Etna/Kilauea/Iceland camera jumps, space-weather → Utsjoki aurora camera; UI "LIVE LOOK-INS" row validated
- reverse links: camera discoveries show "Part of the investigation" jump back to parent investigation (validated in browser)

State: 10 investigations generating consistently (attention gap, air divide, volcanoes, seismic week, space weather, orbital cadence, ukraine, sudan, seismic ripple, event attention gap). Production still Vercel-quota-blocked (rolling 24h, `api-deployments-free-per-day`); everything local-only per user instruction. PR #1 last pushed commit `ce45ada` is far behind local.

Next hill-climb candidates:
- more investigation breadth (IODA internet outages timed out — retry or find alternative; ReliefWeb keyless; UK grid carbon intensity keyless)
- globe pin declutter in dense regions (Europe overlap)
- Watch mode cinematic polish (auto-advance works at 11s cadence)
- discovery-card uniqueness beyond cameras (eonet/gdacs event cards still generic-ish)
- deploy when Vercel quota frees; then validate production end-to-end
- `dede7b3` seismic-pulse-week liveLink → largest quake of week, with fallback synthesized discovery card (week-catalog quakes may not be in the 24h discoveries feed — link never dead-ends)
- production build green after all investigation work; dev server restarted on port 3000 (plain `next dev` default — 3100 was never scripted)
- surprise-loop validation: Kīlauea crater card showed actual glowing lava in live USGS frame with honest daylight/volcano-status framing — demo-quality moment
- deploy retry at ~13:50 PT still quota-blocked (`api-deployments-free-per-day`, rolling 24h)
- `ea02c12` investigation payload cache: rail loads 1.96s → 9ms on cache hit (4min TTL, stale fallback on upstream failure)
- `1eaba6e` REAL BUG FIX: shared links / investigation jumps to non-featured registry cameras dead-ended with "This live signal has moved on" — hash resolution and liveLink clicks now fall back to constructing the camera card from the full 459-entry registry. Validated: #camera-mount-etna deep-link renders Mount Etna card with video. CAUTION when validating: CDP Page.navigate to a URL differing only in hash does NOT reload the SPA — use Page.reload or navigate cross-page first.
- gdacs green titles reframed (no more bureaucratic "Green wildfire signal"), scoring reprioritized by alert level (orange/red outrank green noise)
- browser_preview exposed to user: "Elsewhere — live local build" on port 3000 (next dev default port — dev script has no -p flag)
- ReliefWeb API reachable and keyless (api.reliefweb.int/v1/disasters?appname=elsewhere&preset=current) — candidate for next humanitarian investigation; response shape differs from docs (check pagination wrapper before use)
- deploy retry ~14:15 PT: still quota-blocked. Next retry worthwhile ~09:00 PT next day (24h after the morning burst)
- remaining ideas queue: ReliefWeb current-disasters investigation, globe pin declutter in dense regions, Watch-mode cinematic polish, eonet/gdacs event card connections enrichment, iOS strategy doc (task 23 pending)
- ReliefWeb probing: base endpoint returns JSON but with totalCount missing in some responses; the fields[include] bracket query returned non-JSON (needs URL-encoded brackets or different param style) — finish probe before implementing
- NOTE orbital-cadence drops out when Launch Library 429s persist across server restarts (memory cache is in-process); acceptable degradation, recovers when rate limit clears

## Round 2026-11-26 afternoon II
- pin quality hierarchy (video large, stills small), watch-mode cinematic fade validated, mobile chart caption overlap fixed
- NWS alert cards place-specific ("Flood Warning — Jones, NC") with real description texture
- EPIC full-disk Earth card (keyless epic.gsfc.nasa.gov) — validated rendering, honest 70h lag
- iOS strategy doc committed + Safari install hint shipped; apple-touch-icon already existed
- OG/Twitter meta + og-image.png (crop of Etna venting screenshot) — shared links now render rich previews; FUTURE: per-discovery dynamic OG needs query-param share urls (?d=id) + generateMetadata + /api/og image route
- dead ends: ReliefWeb needs approved appname; WHO DON rss 404; open-notify unreachable; usgs waterservices 10-15s per query (only viable as on-demand lens, low value without flood-stage context)
- console error audit across surprise+investigate flows: 0 errors

## Round IV — investigations depth + living planet (Nov 26 ~15:00 PT)
- empty-sky-audit investigation: throttled ADS-B sampling (adsb.lol rate limit ~1 req/sec) across 6 conflict zones + 4 controls, 8min in-process cache. Ukraine/Sudan/Syria/Yemen measured silent vs 125-340 control aircraft. Honest receiver-density caveat included.
- planet-emergency-board investigation: full GDACS board (~156 active modeled alerts) via parseGdacsItems refactor; visuals by type; liveLinks to top 3 events with lat/lon fallback.
- terminator card: dawn/dusk megacity computed from NOAA solar position math — no upstream feed, always fresh.
- aurora-watch upgraded to composite verdict: Kp + darkness + cloud at Utsjoki camera with blocking-reason labeling; connection link to camera-utsjoki-aurora.
- investigations route: stale-while-revalidate (600s fresh) — cold ADS-B fill takes 15s+, never blocks the rail after first fill.
- sky layer global: OpenSky /states/all stride-sampled to ~2600 airborne aircraft, 69KB payload, 45s cache. Visually validated — subtle shimmer at globe scale.
- GOTCHA: `pkill -f next-server` / pgrep loops kill BOTH dev and prod (same process name) AND the invoking shell itself. Use ss -tlnp + port to find pid.

## Round V — shareability (Nov 26 ~15:20 PT)
- Share button now copies ?d=<id> query links instead of hash URLs (hash never reaches server → no OG possible).
- app/page.tsx generateMetadata resolves ?d= against live catalog (10min in-process cache) → dynamic og:title/description + discovery mediaImage when available. Registry fallback for any camera-* id. Validated: /?d=iss-over-earth renders "The ISS is crossing the planet in silence".
- Cold first shared hit pays investigations fill (~14s with ADS-B throttle) once per 10min cache window — accepted, crawler-only traffic.
- Mobile 390x844 validated: bottom sheet card, globe with aircraft specks, action dock all render correctly.

## Round VI — census + consolidation (Nov 26 ~15:45 PT)
- airborne-now card: global ADS-B census (5,111 aircraft aloft at validation, ~0.5M estimated souls). Shares OpenSky snapshot with sky layer via getGlobalAircraft() in lib/live (60s cache) — api/sky now thin wrapper.
- emergency-board title now leads with serious (red+orange) count vs total hazards.
- watchdog.sh keeps dev:3000 and prod:3212 alive overnight (60s loop, logged to /tmp/watchdog.log).
- Full-loop validation: 0 console errors across surprise×2 + investigate at 1440px.
- PUSHED everything to origin devin/discover-polish as backup — PR #1 current through f253aab. CI still fails only on Vercel deploy quota.

## Round VII — Living planet layers + sensory depth (2026-11-26 evening PT)
- Persistent globe data layers: week of earthquakes (age-colored: hot white-orange <90min fading to dim embers), active fires, storms/floods, volcanoes, and a live aurora oval from NOAA's ovation model — all with a bottom-left legend.
- Generative ambient sound (WebAudio, no assets): root frequency tuned per discovery visual type, wind noise for ocean. Toggle in dock; icon-only on mobile.
- Return-visitor memory note: "N new live moments since [date] — including …" from localStorage diff. Validated end-to-end.
- Cinematic intro: camera zooms in from deep space over 3.2s + staggered hero text.
- Breaking-event toast: major quake/fire/storm entering the feed mid-session announces itself; tap to travel there.
- ISS next city overflight prediction from live TLE propagation ("in ~58 minutes it sweeps across the sky above São Paulo — 22 million people below").
- Event-aware camera curation: cameras within 320km of a GDACS-modeled hazard boosted with "camera is the ground truth" framing; volcano cams boosted extra during volcanic unrest.
- Mobile GPU budget: capped DPR 1.5, half starfield, no AA on small screens.
- New investigations: sunset-chase-live (aircraft classified by solar elevation — 126 in the twilight band at first measurement) and wildest-water-live (Drake Passage 15× rougher than Red Sea, live wave heights across 14 seas). 13 investigations total.
- Polar extremes card: sun never rises on Longyearbyen / never sets on South Pole Station, computed live, rotates seasonally.

## Round VIII checkpoint (post-review hill-climbing, local-only)
- Fixed all 9 Devin Review findings across two rounds: airborne census magnitude (100x inflated people-aloft, meters-vs-feet altitude), invented seismic evidence on investigation links (now honest place-probe), camera/place cards yanked by feed refresh, 8 misattributed camera pins removed (honest absence beats fake coverage), polar worldview bbox inversion + honest swath labeling, megacity comparison removed, metadata crawler amplification dedupe + negative caching.
- New cards: wildlife-pulse (iNaturalist live sightings with real photos, network total), earth-extremes-now (16-site batched Open-Meteo: hottest/coldest/windiest at the same minute), humanity-darkness-now (40-metro population-weighted day/night/twilight split, pure geometry), point-nemo-iss (conditional wow-moment: ISS crew are the nearest humans to the oceanic pole of inaccessibility when within range).
- Feed now ~34 discovery cards.

## Round IX checkpoint
- Devin Review round 3: all 8 findings real and fixed — wildlife honesty (quality-grade labeling, observation-vs-upload timing, per-sighting share ids), exact Point Nemo spherical chord geometry + 'almost certainly' framing, terminator marker moved onto the equator (exactly 0° elevation always), civil-darkness wording honest, related-topic taps now resolve to real cards/investigations (wildest water, terminator, aurora, volcanoes...) instead of generic weather.
- Camera rotation: 6 curated anchors + 8 rotating quality picks from the full registry every 30 min, generated fallback copy — the Surprise loop no longer shows the same 14 cameras forever.
- Prod chunk-recovery: stale-chunk crash after redeploys now auto-reloads once.
- Round IX continued: review round 4 — fixed rotation-induced bugs at root (single rotation snapshot per feed build, no more weather misalignment or yanked cameras), dedupe of dedicated camera cards, feed-updates-win precedence. My sky button: geolocation → probePlace (overhead aircraft within 100nm were already in the place probe). Mobile dock icon-only for 5-button fit. metadataBase set.
- Round X: My sky geolocation probe (privacy-rounding, honest error feedback), satellite time-lapse loops on GOES imagery (600px with 1000px fallback for Alaska-class sectors), Wikipedia geosearch notable-nearby stories in place probes, watch-mode video spectacle bias, 24+ review-driven fixes total. Backup pushes now batched to reduce CI-quota noise.
- Round XI cont.: Watch mode dwell is adaptive (26s for video cards, 12s for viz) with autoplaying video — the planet runs as a self-playing channel. Wiki notable-filter iterated through 3 review rounds; settled: only unambiguous administrative noise filtered. EONET card prefers fires/severe storms/volcanoes. Push policy: batched, ~2-3h cadence to limit Vercel quota noise. Prod preview port 3212 is current through d675938+.
