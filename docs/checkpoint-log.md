
## 2026-11-27 early AM — measured-planet era
- Feed at 40 cards incl: buoys (measured waves + air-sea heat exchange), sea-defies-moon tide anomaly (+84cm at The Battery), GLM full-disk lightning, radio×3 (validated Kameme FM Kenya), flare-dynamic solar, conditional cyclone/felt-quake, SWPC-alert aurora
- 13 investigations, measured-planet-live now leads rail (instruments-only synthesis)
- Review rounds: 30+ real bugs fixed total; latest round ca7efab (ordering, midnight tides, sign, full-disk GLM, storm false-positives, satellite refresh)
- Weather resilient via met.no fallback (open-meteo quota-proof)
- Radio Earth validated visually mobile; audio element confirmed; autoplay after gesture works in tour
- All pushed through ca7efab; prod+tunnel verified 200

## 2026-11-27 (night, continued) — measured-planet era, hour 4
- Volcanic unrest swarm detector: conditional card when 4+ quakes/24h cluster within ~100km of 8 major volcanoes (Etna, Kīlauea, Merapi, Fagradalsfjall, Popocatépetl, Sakurajima, Stromboli, Erebus). Quiet now — honest absence.
- Extremes card now carries a generated thermometer-ladder chart (16 sites sorted coldest→hottest).
- Review round on 249a63d: 8/8 findings real, all fixed in d98ffd2 — sparse tide charts (threshold 2 pts), buoy wind+pressure now ONE corroboration not two, severity from provider us_aqi, blank-radar tiles detected by byte-size server-side (satellite kept instead), CO2 honestly labeled daily, wiki rate counts only human wikipedia.org article edits, quake-visibility requires surface-wave travel time to station, drumplot copy no longer invents line durations.
- Tunnel: https://employee-expires-rebel-thread.trycloudflare.com (current). Prod rebuilt + verified 200 on both.

## 2026-11-27 (morning, hours 5-13) — measurement era consolidated
- Statistical novelty detection (noveltyZ): cards score-boosted when the latest reading is extreme vs the instrument's own 30h baseline — the instrument decides what's interesting, not arbitrary thresholds.
- Evidence charts everywhere: wave heights, pressure tendencies (barometer trace IS the storm story), Keeling Curve (2-year sawtooth, validated beautiful on mobile), air-quality city ladder, extremes thermometer, terminator sun-arc, polar-night flatline, humanity-in-daylight curve, UK grid carbon pulse. Unit-aware footers (hours/days/years), actuals-only honesty.
- New cards: ocean skin temperature (NOAA daily satellite analysis), regional surge detection (multi-gauge network agreement — fired live as the NY storm spread), volcanic swarm cameras embedded.
- Infrastructure: feed cache (stale-while-revalidate, 5.9s cold → 21ms warm — critical for public sharing), instrument history persisted across restarts, guardian daemon (/tmp/discover-guardian.sh) keeps prod+dev+tunnel alive and warms cache after restarts.
- Review loop total: 38+ real bugs fixed across 9 rounds. Latest: launch imagery object form, serverless cache freeze, pressure-clock skew from rows missing wave data, SST copy overclaiming.
- Launch cards carry real mission imagery. All 16 live video feeds verified valid.
- Dead ends documented: IODA unreachable, DART tsunami buoys form-gated.
