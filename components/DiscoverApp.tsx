'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Compass, Eye, Globe2, Loader2, Newspaper, Play, Radio, Shuffle, Sparkles, X } from 'lucide-react';
import Globe from './Globe';
import type { Discovery, Investigation } from '@/lib/types';

const kindLabel = { observed: 'Observed', verified: 'Verified report', interpretation: 'Interpretation', prediction: 'Prediction', question: 'Open question' } as const;

function angularDistance(latA: number, lonA: number, latB: number, lonB: number) {
  const rad = Math.PI / 180;
  const aLat = latA * rad, bLat = latB * rad, dLat = (latB - latA) * rad, dLon = (lonB - lonA) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) / rad;
}

export default function DiscoverApp() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [active, setActive] = useState<Discovery>();
  const [mode, setMode] = useState<'discover' | 'investigate'>('discover');
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation>();
  const [watching, setWatching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState<any>();
  const [lensLoading, setLensLoading] = useState(false);
  const [path, setPath] = useState<Discovery[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (initial = false) => {
      const [d, i] = await Promise.all([
        fetch('/api/discoveries', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ discoveries: [] })),
        fetch('/api/investigations', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ investigations: [] }))
      ]);
      if (cancelled) return;
      const nextDiscoveries = d.discoveries ?? [];
      const nextInvestigations = i.investigations ?? [];
      setDiscoveries(nextDiscoveries);
      setInvestigations(nextInvestigations);
      setActive(current => {
        if (!current) return nextDiscoveries[0];
        if (current.id.startsWith('place-')) return current;
        return nextDiscoveries.find((item: Discovery) => item.id === current.id) ?? nextDiscoveries[0] ?? current;
      });
      setSelectedInvestigation(current => current ? nextInvestigations.find((item: Investigation) => item.id === current.id) ?? nextInvestigations[0] : nextInvestigations[0]);
      if (!initial) {
        setLens(undefined);
        setLensLoading(false);
      }
      if (initial) setLoading(false);
    };
    void load(true);
    const refresh = window.setInterval(() => void load(), 90000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const surprise = (reveal = true) => {
    if (!discoveries.length) return;
    // Spectacle first: operational context data remains available as supporting evidence,
    // but primary surprises are weighted toward rare, visual, high-signal moments.
    const pool = discoveries.filter(d => d.id !== active?.id && d.score >= 70);
    const weighted = pool.flatMap(d => Array(Math.max(1, Math.round(d.score / 12))).fill(d));
    setActive(weighted[Math.floor(Math.random() * weighted.length)] ?? discoveries[0]);
    setLens(undefined);
    setLensLoading(false);
    setPath([]);
    if (reveal) setPanelOpen(true);
    setMode('discover');
  };

  const selectDiscovery = (discovery: Discovery, point?: { lat: number; lon: number }, preservePath = false) => {
    if (point) {
      void probePlace(point);
      return;
    }
    setActive(discovery);
    setLens(undefined);
    setLensLoading(false);
    if (!preservePath) setPath([discovery]);
    setPanelOpen(true);
    setMode('discover');
  };

  const probePlace = async (point: { lat: number; lon: number }) => {
    setLens(undefined);
    setLensLoading(false);
    setPath([]);
    setPanelOpen(true);
    setMode('discover');
    setActive({
      id: 'place-pulse-loading', template: 'atmosphere', title: 'Reading this point on Earth', kicker: 'Direct exploration', visual: 'orbital', score: 70, freshness: 'listening now',
      location: { lat: point.lat, lon: point.lon, label: `${point.lat.toFixed(1)}°, ${point.lon.toFixed(1)}°` },
      summary: 'Elsewhere is reverse-geocoding this point and reading current public atmospheric data before connecting it to nearby live signals.',
      facts: [], sources: [], related: []
    });
    try {
      const response = await fetch(`/api/place?lat=${point.lat}&lon=${point.lon}`);
      const data = await response.json();
      const place = data.place;
      const nearest = discoveries
        .map(d => ({ d, distance: angularDistance(point.lat, point.lon, d.location.lat, d.location.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map(({ d, distance }) => ({ id: d.id, title: d.title, reason: `${Math.round(distance)}° away — nearest concurrent public signal`, strength: Math.round(100 - distance) }));
      setActive({
        id: `place-${point.lat.toFixed(2)}-${point.lon.toFixed(2)}`, template: 'atmosphere', title: `A live pulse from ${place.label}`, kicker: 'You found this place', visual: place.country ? 'city' : 'ocean', score: 72, freshness: 'current conditions',
        location: { lat: point.lat, lon: point.lon, label: place.label },
        summary: 'You selected this point directly. Elsewhere is grounding it in current modeled weather, air quality and geography, then connecting it to the nearest concurrent live signals rather than pretending local events are known.',
        facts: place.facts ?? [], connections: nearest,
        sources: [
          { label: 'Open-Meteo current weather', url: 'https://open-meteo.com/', retrievedAt: place.retrievedAt ?? new Date().toISOString() },
          { label: 'BigDataCloud reverse geocode', url: 'https://www.bigdatacloud.com/reverse-geocoding', retrievedAt: place.retrievedAt ?? new Date().toISOString() }
        ],
        related: ['Local weather', 'Nearby signals', 'Night lights']
      });
    } catch {
      setActive(current => current ? { ...current, title: 'This point is hard to read right now', summary: 'The public place/weather services did not answer. No local claim is made.', facts: [{ label: 'Evidence', value: 'Unavailable', kind: 'question' }] } : current);
    }
  };

  const followConnection = (connectionId: string) => {
    const match = discoveries.find(d => d.id === connectionId);
    if (!match || !active) return;
    setPath(current => {
      const base = current.length && current[current.length - 1]?.id === active.id ? current : [active];
      return [...base.filter(d => d.id !== match.id), match];
    });
    selectDiscovery(match, undefined, true);
  };

  const exploreRelated = async (label: string) => {
    if (!active) return;
    setLensLoading(true);
    setLens(undefined);
    setPanelOpen(true);
    setMode('discover');
    if (label.toLowerCase().includes('nearby signals')) {
      setLens({ topic: label, retrievedAt: new Date().toISOString(), facts: (active.connections ?? []).map(c => ({ label: c.title, value: c.reason, kind: 'interpretation' })) });
      setLensLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ topic: label, label: active.location.label, lat: String(active.location.lat), lon: String(active.location.lon) });
      if (active.entityId) params.set('entityId', active.entityId);
      if (active.occurredAt) params.set('occurredAt', active.occurredAt);
      const response = await fetch(`/api/context?${params}`);
      const data = await response.json();
      setLens(data.lens ?? { topic: label, facts: [{ label: 'Evidence', value: 'Unavailable', kind: 'question' }] });
    } catch {
      setLens({ topic: label, facts: [{ label: 'Evidence', value: 'Unavailable', kind: 'question' }] });
    } finally { setLensLoading(false); }
  };

  useEffect(() => {
    if (!watching || discoveries.length < 2) return;
    const timer = window.setInterval(() => surprise(false), 11000);
    return () => window.clearInterval(timer);
  });

  const locationLine = useMemo(() => active ? `${active.location.label} · ${active.freshness}` : 'Reading live Earth signals', [active]);
  const inv = selectedInvestigation ?? investigations[0];
  const globeFocus = mode === 'investigate' && inv ? { id: inv.id, location: inv.location } : active;

  const selectInvestigation = (investigation: Investigation) => {
    setSelectedInvestigation(investigation);
    setMode('investigate');
  };

  return <main className={`mode-${mode}`}>
    <Globe active={globeFocus} discoveries={discoveries} investigations={investigations} onSelect={selectDiscovery} onSelectInvestigation={selectInvestigation} />
    <header className="topbar">
      <div className="brand"><Globe2 size={22} /><span>Elsewhere</span></div>
      <nav>
        <button className={mode === 'discover' ? 'active' : ''} onClick={() => setMode('discover')}><Compass size={16} />Discover</button>
        <button className={mode === 'investigate' ? 'active' : ''} onClick={() => setMode('investigate')}><Newspaper size={16} />Investigate</button>
      </nav>
    </header>

    <section className="heroCopy">
      <motion.p>Live Earth intelligence</motion.p>
      <motion.h1>Discover what’s happening.<br /><span>Understand what it means.</span></motion.h1>
      <motion.p className="interactionHint">Drag Earth · tap anywhere · follow the evidence</motion.p>
    </section>

    <div className="actionDock">
      <button className="surprise" onClick={() => surprise()} disabled={loading}><Shuffle size={20} />{loading ? 'Listening…' : 'Surprise Me'}</button>
      <button className={watching ? 'watch active' : 'watch'} onClick={() => setWatching(!watching)}><Play size={17} />{watching ? 'Watching' : 'Watch'}</button>
    </div>

    <AnimatePresence mode="wait">
      {mode === 'discover' && active && panelOpen && <motion.aside key={active.id} className="discoveryPanel" initial={{ opacity: 0, y: 42, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 26, scale: .985 }} transition={{ type: 'spring', damping: 26, stiffness: 230 }}>
        <button className="panelClose" aria-label="Hide discovery" onClick={() => setPanelOpen(false)}><X size={17} /></button>
        <div className="panelMedia">{active.visual === 'nasa-live' ?
          <iframe title="NASA live video" src="https://www.youtube.com/embed/ROboUHfPUrU?rel=0" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : active.mediaVideo ?
          <iframe title={`${active.title} live video`} src={active.mediaVideo} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /> :
          <><VisualMotif kind={active.visual} />{active.mediaImage && <LiveImage src={active.mediaImage} alt={active.mediaAlt ?? active.title} />}</>}
          <div className="mediaTag"><Radio size={13} />{active.visual === 'nasa-live' || active.mediaVideo ? 'Authorized live video embed' : active.mediaImage ? 'Live public imagery + visualization' : 'Animated evidence visualization'}</div>
        </div>
        <div className="panelBody">
          <div className="eyebrow"><Sparkles size={14} />{active.kicker}</div>
          <h2>{active.title}</h2>
          <p className="location">{locationLine}</p>
          <p className="summary">{active.summary}</p>
          <div className="factGrid">{active.facts.map(f => <div key={f.label} className={`fact ${f.kind}`}><span>{f.label}</span><strong>{f.value}</strong><em>{kindLabel[f.kind]}</em></div>)}</div>
          {path.length > 1 && <div className="evidencePath"><span>Evidence path</span><div>{path.map((d, i) => <button key={`${d.id}-${i}`} onClick={() => selectDiscovery(d, undefined, true)} className={d.id === active.id ? 'active' : ''}>{d.title}</button>)}</div></div>}
          {Boolean(active.connections?.length) && <div className="connections"><span>Connected signals</span>{active.connections?.map(c => <button key={c.id} onClick={() => followConnection(c.id)}><b>{c.title}</b><small>{c.reason}</small></button>)}</div>}
          <div className="rabbit"><span>Explore further</span>{active.related.map(r => <button key={r} onClick={() => exploreRelated(r)}>{r}<ArrowRight size={13} /></button>)}</div>
          {lensLoading && <div className="contextLens"><b>Reading local evidence…</b></div>}
          {lens && <div className="contextLens"><b>{lens.topic}</b>{lens.retrievedAt && <small className="lensTime">retrieved {new Date(lens.retrievedAt).toLocaleTimeString()}</small>}<div className="lensGrid">{lens.facts?.map((f: any) => <div key={f.label} className={`lensFact ${f.kind}`}><span>{f.label}</span><p>{f.value}</p></div>)}</div></div>}
          <details className="sources"><summary>Evidence and sources</summary>{active.sources.map(s => <a key={s.url} href={s.url} target="_blank">{s.label}<small>{new Date(s.retrievedAt).toLocaleTimeString()}</small></a>)}</details>
        </div>
      </motion.aside>}

      {mode === 'investigate' && inv && <motion.aside key={inv.id} className="discoveryPanel investigation" initial={{ opacity: 0, y: 42 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 26 }}>
        <div className="investHeader"><div><div className="eyebrow"><Eye size={14} />Beyond the headlines</div><h2>{inv.title}</h2><p className="location">{inv.location.label} · confidence {inv.confidence}%</p></div><button onClick={() => setMode('discover')}><X size={18} /></button></div>
        <p className="summary">{inv.dek}</p>
        <div className="factGrid metrics">{inv.metrics.map(m => <div key={m.label} className="fact"><span>{m.label}</span><strong>{m.value}</strong><em>{m.delta}</em></div>)}</div>
        <div className="evidence">{inv.evidence.map((e, i) => <div key={i} className={`line ${e.kind}`}><b>{kindLabel[e.kind]}</b><p>{e.text}</p></div>)}</div>
        <details className="sources" open><summary>Sources</summary>{inv.sources.map(s => <a key={s.url} href={s.url} target="_blank">{s.label}</a>)}</details>
      </motion.aside>}
    </AnimatePresence>

    {mode === 'investigate' && investigations.length > 1 && <div className="investRail">{investigations.map(i => <button key={i.id} onClick={() => setSelectedInvestigation(i)} className={i.id === inv?.id ? 'active' : ''}>{i.title}</button>)}</div>}
    {mode === 'discover' && active && !panelOpen && <button className="reopen" onClick={() => setPanelOpen(true)}>{active.kicker}</button>}
    {loading && <div className="loading"><Loader2 className="spin" />Listening to public Earth signals…</div>}
  </main>;
}

function LiveImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return null;
  return <img className="liveImage" src={src} alt={alt} onError={() => setFailed(true)} />;
}

function VisualMotif({ kind }: { kind: Discovery['visual'] }) {
  return <div className={`motif ${kind}`} aria-hidden="true">
    {kind === 'aurora' && <><i className="ribbon a" /><i className="ribbon b" /><i className="ribbon c" /><div className="horizon" /></>}
    {kind === 'seismic' && <><i className="epicenter" /><i className="shock s1" /><i className="shock s2" /><svg className="wave" viewBox="0 0 420 100"><path d="M0 52 L82 52 L101 18 L123 86 L147 31 L168 52 L420 52" /></svg></>}
    {kind === 'fire' && <><div className="fireGlow" /><i className="smoke sm1" /><i className="smoke sm2" /><i className="smoke sm3" /><i className="flameCore" /><div className="ridge" />{Array.from({ length: 18 }, (_, i) => <i key={i} className="ember" style={{ left: `${7 + i * 5}%`, animationDelay: `${(i % 7) * .42}s` }} />)}</>}
    {kind === 'launch' && <><svg className="trajectory" viewBox="0 0 420 180"><path d="M35 172 C120 145 190 92 376 20" /></svg><i className="rocket" /><i className="flame" /><div className="pad" /></>}
    {kind === 'ocean' && <><i className="moon" />{Array.from({ length: 4 }, (_, i) => <i key={i} className={`swell w${i + 1}`} />)}<div className="beam" /></>}
    {kind === 'city' && <><i className="sunrise" /><div className="skyline">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ height: `${24 + (i * 17) % 58}px` }} />)}</div></>}
    {(kind === 'orbital' || kind === 'nasa-live') && <><i className="orbitLine" /><i className="satelliteDot" /><i className="scan" /></>}
    {!['aurora','seismic','fire','launch','ocean','city','orbital','nasa-live'].includes(kind) && <><div className="pulse" /><div className="ring r1" /><div className="ring r2" /></>}
  </div>;
}
