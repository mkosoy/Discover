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
- GDACS humanitarian hazard cards added with current-event filtering, impact imagery and exposure-model lenses.
- Ukraine and Sudan investigations use conflict-filtered news attention, weather, OCHA FTS, HDX and UNHCR displacement data.
- Ukraine now includes a non-tactical live public-aircraft contrast: coarse ADS-B counts over a Ukraine-centered sample versus neighboring-country-centered samples, with receiver/coverage caveats and a visual comparison bar.
- Sudan includes attention-per-million-IDP normalization when samples are comparable; one-sided or capped samples are not visualized as false precision.
- ISS now includes a smooth propagated orbital track from the current public TLE, with orbit-model freshness shown as evidence.
- Ukraine now opens with NASA MODIS latest-available true-color satellite-swath imagery plus explicit non-surveillance caveats; attention cadence is visualized in 2h bins without claiming capped samples are total volume. Sudan, significant-earthquake and under-covered-event investigations also use latest-available MODIS visual context with explicit orbital/cloud/timing caveats.
- Mount Etna live-camera discovery added, with current wind/weather and volcano-specific ash/air-quality/seismic lenses.
- Approximate sunlight/day-night lighting, duplicate-marker spreading, shortened NWS deep-link ids, compact evidence sections and no-immediate-repeat Surprise/Watch weighting improve polish.
- Share/deep links exist for discoveries, investigations and arbitrary tapped places, including truthful unavailable states when ephemeral live cards expire.
- Mobile bottom sheet compacted; hero hides while the evidence panel is open.
- Evidence lenses now cover satellite imagery, alert timing, exposure models, event timelines, marine conditions, air quality, grid history, launch weather, aftershocks, aurora visibility, volcano ash/seismic context and night-light caveats.

## Known gaps / next best improvements

1. Production is behind PR #1 until the Vercel deployment quota resets or the plan changes; current work is intentionally local-only.
2. Some generic lenses remain weaker than the dedicated lenses; keep replacing them with evidence-specific views.
3. Surprise/Watch can still improve diversity scoring and avoid visually similar consecutive moments.
4. Globe labels are minimal; marker affordance and tap feedback can become more magical.
5. Investigations have their first visual comparisons but still need richer editorial presentation and more comparative evidence types.
6. Real mobile-device validation is still needed for embed behavior, panel scrolling, investigation rail usability and WebGL performance.
