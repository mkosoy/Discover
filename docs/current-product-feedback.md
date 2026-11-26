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
- Mobile bottom sheet compacted; hero hides while the evidence panel is open.
- Evidence lenses now cover satellite imagery, alert timing, exposure models, event timelines, marine conditions, air quality, grid history, launch weather, aftershocks, aurora visibility and night-light caveats.

## Known gaps / next best improvements

1. Production is behind PR #1 until the Vercel deployment quota resets or the plan changes.
2. Some generic lenses remain weaker than the dedicated lenses; keep replacing them with evidence-specific views.
3. No share/deep-link state yet.
4. Surprise/Watch can still improve diversity scoring and avoid visually similar consecutive moments.
5. Globe labels are minimal; marker affordance and tap feedback can become more magical.
6. Investigations need more visual/editorial presentation, not only metric cards and prose.
7. Real mobile-device validation is still needed for embed behavior, panel scrolling and WebGL performance.
