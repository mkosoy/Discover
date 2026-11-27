
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

## 2026-11-27 00:35–04:15 PT — insights-and-connections era (second overnight run)

User direction: "Teach the app how to make insights and connections. Think of things that feel like they shouldn't be around but are normal public APIs." Plus: clean up the data, audit what exists, 5 hours non-stop local-only.

### New detection engines (the insight layer)
- **Convergence engine** — when multiple independent instrument types observe the same physical event, cards get score boosts + a "Convergent evidence" fact. Patterns: coastal storm (tide+barometer+forecast), space-weather chain (flare→wind→aurora), volcanic unrest, tsunami chain, human pulse. First activation: the nor'easter — 3 instruments agreeing for 2+ days, ranked #1 correctly.
- **Earth-delta engine** — feed snapshots persisted every generation; card diffs now vs 1h ago: new events, faded events, fastest-moving instruments. "The planet as a diff."
- **Meta-scan** — z-score novelty across all instrument series (buoys, DART, Kp, UK grid, X-ray flux log-scale); fires only at ≥2.5σ (correct for multiple comparisons — when it fires it's real). z-baseline excludes the latest point.
- **Wiki edit-burst detector** — rolling 12-min window across generations; behavioral breaking-news detection.

### New data sources ("shouldn't be public but is")
- **NASA Deep Space Network XML** — LIVE: which dishes hear which spacecraft + round-trip light time. Voyager 1 at Madrid, 24h one-way light time. Light-time ladder SVG. The poetic centerpiece.
- **Military aircraft** (adsb.lol /v2/mil) — ~90 broadcasting publicly, tankers/transports, honest boundary framing.
- **open-notify astros** — 12 named humans off-planet, animated orbital crew viz.
- **DART seafloor pressure** — tsunami-warning buoys measuring 5,694m of ocean overhead. Same realtime2 channel, `.dart` suffix, 8 columns not 9.
- **USGS river discharge** — 4 continental rivers, own 10-min cache tier (12s upstream too slow for main batch). Colorado dam-release detection on first contact. Sort newest-first→ascending required for charts.
- **P2Pquake** — Japan tsunami bulletins, conditional card.
- **Celestrak: dead** (timeouts). LiveATC: streams block datacenter IPs — card pulled after honest non-verification. sensor.community: dense Europe/empty where it matters. Orcasound: API exists but stream URLs need reverse engineering — parked.

### Generative animated substitutes (SMIL in data-uri SVG animates inside <img>!)
- Orbital crew visualization, military sky map with real positions, radio waveform, wiki edit rain — all animated, all data-driven, zero client JS.

### Data cleanup (user explicitly asked)
- Deleted weak/redundant cards: nazare-swell (model-only, redundant with measured buoys), tokyo-air-corridor.
- met.no fallback pressure mapping, river outlier filtering, time-sort fix, delta window-accurate titles, crew roster honesty labels.
