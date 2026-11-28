# Elsewhere — iOS Strategy and App Store Path

Status: analysis + recommendation, no build work started. The web product is the priority until the Vercel deployment is current.

## The core question

Elsewhere's magic is a live, GPU-rendered globe plus real-time data feeds. None of that requires native code — but the App Store is distribution, discovery, and the default mental model for "mobile app" among the exact audience (curious mainstream users) this product targets.

## Recommended path: three phases

### Phase 1 — Installable PWA (zero new code, ready now)
The manifest already ships standalone display, maskable icons, dark theme. Missing pieces for a good install experience:
- Apple-specific meta tags (`apple-touch-icon`, `apple-mobile-web-app-capable`, splash screens). Small, cheap, worth doing now.
- iOS Safari quirks: no install prompt — users must use Share → Add to Home Screen. The UI can teach this with a one-line hint on first mobile visit (cheap, high value).
- Verify: YouTube embeds and HLS still-image refresh inside standalone mode (no browser chrome).

Cost: ~a few hours. Value: anyone can "install" Elsewhere today; also de-risks Phase 2 because the same shell wraps identical code.

### Phase 2 — Capacitor-wrapped App Store build (the recommended first native step)
Capacitor wraps the exact Next.js web build in a native WKWebView shell. This is the pragmatic path because:
- Three.js/WebGL runs natively in WKWebView at full GPU speed — the globe needs no rewrite.
- The data layer is already serverless API routes (hosted on Vercel) — the app is a thin client, so the wrapper has no backend duplication.
- Native additions that actually justify the wrapper (and pass App Store review guideline 4.2 "minimum functionality"): push notifications for significant events (a major eruption starts, a geomagnetic storm begins, the ISS passes over you), Home Screen quick actions, share extension, optional native haptics on discovery reveal.

Guideline 4.2 is the real gate: Apple rejects apps that are "simply a web view" without app-like value. The honest mitigations:
1. Notifications are the strongest justification — "your planet taps you when something happens" is inherently app-native and genuinely useful.
2. Location-aware "the sky above you right now" (ISS passes, aurora visibility, satellites) uses native location permission meaningfully.
3. Offline last-seen snapshot caching.

Cost: 1-2 sessions including Apple Developer account setup ($99/yr — requires Mark's purchase approval). Value: real App Store presence with minimal fork of the codebase.

### Phase 3 — Native or React Native (only if metrics demand it)
Only worth it if usage data shows the WebView bottlenecking the experience (unlikely for this workload) or if the product grows features that need deep native integration (ARKit sky view, Live Activities for tracked events, watchOS complications — a "currently erupting" complication is a genuinely delightful fit).

## App Store review risk assessment
- 4.2 minimum functionality: mitigated by notifications + location features above.
- 2.3.1 hidden/undocumented features: none — everything is public data.
- 1.2 user-generated content: not applicable (no UGC).
- Content sensitivity: conflict-zone coverage should stay non-tactical and humanitarian-framed in review notes; the evidence taxonomy (observed/verified/interpretation/question) is an asset here — cite it in the review notes.
- Privacy: location used only for sky-overhead features; needs a purpose string. No accounts, no tracking — the privacy label is nearly empty, which is itself a competitive advantage.

## UX adaptations for iOS specifically
- Bottom-sheet discovery panel already matches iOS idioms; add swipe-to-dismiss gesture.
- Safe-area insets already handled for the dock; verify camera lens overlay.
- Haptic tick on Surprise reveal and globe snap.
- Reduce autoplaying video default on cellular — poster-first already implemented; keep it.
- The globe is the input method: on small screens consider a slight initial tilt toward the user's own continent (familiarity hook) — test, don't assume.

## Decision needed from Mark
1. Approve Apple Developer Program enrollment ($99/yr) — the only paid commitment on this path.
2. Timing: wrap now vs. after the web product has its first user-feedback cycle. Recommendation: after — the web feedback loop is faster, and the wrapper inherits whatever the web learns.
