'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Compass, Eye, Globe2, Loader2, Newspaper, Play, Radio, Satellite, Share2, Shuffle, Sparkles, X } from 'lucide-react';
import Globe from './Globe';
import type { Discovery, Investigation } from '@/lib/types';
import { cameraCoverage, cameraEmbed, publicCameras, type PublicCamera } from '@/lib/cameras';

const kindLabel = { observed: 'Observed', verified: 'Verified report', interpretation: 'Interpretation', prediction: 'Prediction', question: 'Open question' } as const;

function angularDistance(latA: number, lonA: number, latB: number, lonB: number) {
  const rad = Math.PI / 180;
  const aLat = latA * rad, bLat = latB * rad, dLat = (latB - latA) * rad, dLon = (lonB - lonA) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) / rad;
}

function placeConnectionReason(discovery: Discovery, distance: number) {
  const proximity = distance < 8 ? 'same broad region' : distance < 22 ? 'regional comparison' : 'same planetary moment';
  if (discovery.visual === 'storm') return `${proximity} — satellite cloud structure can be compared with local weather, but imagery does not verify ground impacts`;
  if (discovery.visual === 'fire') return `${proximity} — hazard tracking can be checked against local wind, air quality and heat without assuming damage`;
  if (discovery.visual === 'seismic') return `${proximity} — seismic observations can be compared with nearby earthquakes and tsunami-relevant geography`;
  if (discovery.visual === 'aurora' || discovery.visual === 'orbital') return `${proximity} — a shared near-Earth space-environment layer rather than a local cause`;
  if (discovery.visual === 'ocean') return `${proximity} — ocean and atmospheric forcing can be compared as concurrent model evidence`;
  if (discovery.visual === 'city') return `${proximity} — urban infrastructure, mobility and environmental systems operating at the same moment`;
  return `${proximity} — nearest concurrent public signal`;
}

function unavailableSharedDiscovery(id: string): Discovery {
  return {
    id, unavailable: true, template: 'atmosphere', title: 'This live signal has moved on', kicker: 'Shared link', visual: 'orbital', score: 40, freshness: 'no longer in the live feed',
    location: { lat: 0, lon: 0, label: 'Live feed snapshot unavailable' },
    summary: 'The shared discovery is not in the current public feed. Because Elsewhere does not fabricate or replay unverified evidence, this link cannot reconstruct the original live card.',
    facts: [
      { label: 'Shared item', value: id || 'Unknown', kind: 'verified' },
      { label: 'Current evidence', value: 'Unavailable from the live feed', kind: 'question' },
      { label: 'What happened', value: 'Live signals expire as public data updates', kind: 'interpretation' }
    ],
    sources: [], related: []
  };
}


function discoveryForCamera(camera: PublicCamera): Discovery {
  const coverage = cameraCoverage();
  return {
    id: `camera-pin-${camera.id}`, template: 'atmosphere', title: camera.title, kicker: 'Live look-in', visual: camera.kind === 'water' ? 'ocean' : camera.kind === 'aurora' ? 'aurora' : camera.kind === 'volcano' ? 'fire' : 'city',
    score: camera.quality, freshness: 'validated public live-camera registry',
    location: { lat: camera.lat, lon: camera.lon, label: camera.place },
    summary: `${camera.place} is available as an authorized public live video look-in. ${camera.approximate ? 'Its map position is a city/country-level estimate, so use distance and source context carefully.' : 'Its map position is curated to the camera location.'}`,
    facts: [
      { label: 'Camera source', value: camera.sourceName ? `${camera.sourceName} public camera, YouTube embed` : 'Authorized public YouTube embed', kind: 'verified' },
      { label: 'Registry confidence', value: `${camera.quality}/100${camera.confidence ? ` · ${camera.confidence}` : ''}`, kind: 'interpretation' },
      { label: 'Position precision', value: camera.approximate ? 'City/country-level estimate' : 'Camera-specific curated position', kind: camera.approximate ? 'question' : 'verified' },
      { label: 'Registry coverage', value: `${coverage.total} public look-ins across ${coverage.countries} countries`, kind: 'observed' }
    ],
    mediaVideo: camera.youtubeId ? cameraEmbed(camera) : undefined,
    mediaImage: camera.stillImage,
    mediaAlt: `${camera.title} live camera image`,
    sources: [{ label: camera.youtubeId ? 'Open source stream on YouTube' : 'Open source camera page', url: camera.youtubeId ? `https://www.youtube.com/watch?v=${camera.youtubeId}` : camera.sourceUrl ?? '#' , retrievedAt: new Date().toISOString() }],
    related: ['Nearby cameras', 'Historical comparison', 'Nearby signals', 'Night lights']
  };
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
  const [copied, setCopied] = useState(false);
  const [initialHash] = useState(() => typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.replace(/^#/, '')));
  const activeRef = useRef<Discovery>();
  const recentSurprisesRef = useRef<string[]>([]);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    let cancelled = false;
    const load = async (initial = false) => {
      const discoveriesPromise = fetch('/api/discoveries', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ discoveries: [] }));
      const investigationsPromise = fetch('/api/investigations', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ investigations: [] }));
      const d = await discoveriesPromise;
      if (cancelled) return;
      const nextDiscoveries = d.discoveries ?? [];
      setDiscoveries(nextDiscoveries);
      const currentActive = activeRef.current;
      const rediscovered = currentActive ? nextDiscoveries.find((item: Discovery) => item.id === currentActive.id) : undefined;
      const nextActive = !currentActive
        ? nextDiscoveries[0]
        : currentActive.id.startsWith('place-')
          ? currentActive
          : rediscovered ?? (currentActive.unavailable ? currentActive : nextDiscoveries[0] ?? currentActive);
      const activeMoved = Boolean(nextActive && currentActive && nextActive.id === currentActive.id && (
        Math.abs(nextActive.location.lat - currentActive.location.lat) > 0.5 ||
        Math.abs(nextActive.location.lon - currentActive.location.lon) > 0.5
      ));
      if (!initial && currentActive && (nextActive?.id !== currentActive.id || activeMoved)) {
        setLens(undefined);
        setLensLoading(false);
      }
      const placeHash = initial && initialHash.startsWith('place=');
      const investigationHash = initial && initialHash.startsWith('investigate-');
      if (placeHash) {
        const [hashLat, hashLon] = initialHash.slice(6).split(',').map(Number);
        if (Number.isFinite(hashLat) && Number.isFinite(hashLon)) void probePlace({ lat: hashLat, lon: hashLon }, nextDiscoveries);
      } else if (initial && initialHash.startsWith('camera-pin-')) {
        const camera = publicCameras.find(item => `camera-pin-${item.id}` === initialHash);
        setActive(camera ? discoveryForCamera(camera) : unavailableSharedDiscovery(initialHash));
      } else if (initial && initialHash && !investigationHash) {
        const targetDiscovery = nextDiscoveries.find((item: Discovery) => item.id === initialHash);
        setActive(targetDiscovery ?? unavailableSharedDiscovery(initialHash));
      } else {
        setActive(nextActive);
      }
      if (initial) setLoading(false);

      const i = await investigationsPromise;
      if (cancelled) return;
      const nextInvestigations = i.investigations ?? [];
      setInvestigations(nextInvestigations);
      if (investigationHash) {
        const hashId = initialHash.replace(/^investigate-/, '');
        const targetInvestigation = nextInvestigations.find((item: Investigation) => item.id === hashId || `investigate-${item.id}` === initialHash);
        if (targetInvestigation) {
          setSelectedInvestigation(targetInvestigation);
          setMode('investigate');
        } else {
          setActive(unavailableSharedDiscovery(initialHash));
          setMode('discover');
        }
      }
      setSelectedInvestigation(current => current ? nextInvestigations.find((item: Investigation) => item.id === current.id) ?? nextInvestigations[0] : nextInvestigations[0]);
    };
    void load(true);
    const refresh = window.setInterval(() => void load(), 60000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const shareCurrent = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this Elsewhere link', window.location.href);
    }
  };

  const surprise = (reveal = true) => {
    if (!discoveries.length) return;
    // Spectacle first: operational context data remains available as supporting evidence,
    // but primary surprises are weighted toward rare, visual, high-signal moments.
    const pool = discoveries.filter(d => d.id !== active?.id && d.score >= 70);
    const freshPool = pool.filter(d => !recentSurprisesRef.current.includes(d.id));
    const candidates = freshPool.length ? freshPool : pool;
    const weighted = candidates.flatMap(d => {
      const templatePenalty = active && d.template === active.template ? 18 : 0;
      const distancePenalty = active && angularDistance(active.location.lat, active.location.lon, d.location.lat, d.location.lon) < 10 ? 10 : 0;
      const weight = Math.max(1, Math.round((d.score - templatePenalty - distancePenalty) / 12));
      return Array(weight).fill(d);
    });
    const next = weighted[Math.floor(Math.random() * weighted.length)] ?? discoveries[0];
    recentSurprisesRef.current = [next.id, ...recentSurprisesRef.current.filter(id => id !== next.id)].slice(0, 6);
    setActive(next);
    setLens(undefined);
    setLensLoading(false);
    setPath([]);
    if (reveal) setPanelOpen(true);
    setMode('discover');
  };

  const selectCamera = (camera: PublicCamera) => {
    setActive(discoveryForCamera(camera));
    setLens(undefined);
    setLensLoading(false);
    setPath([]);
    setPanelOpen(true);
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

  const probePlace = async (point: { lat: number; lon: number }, availableDiscoveries = discoveries) => {
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
      const nearest = availableDiscoveries
        .map(d => ({ d, distance: angularDistance(point.lat, point.lon, d.location.lat, d.location.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map(({ d, distance }) => ({ id: d.id, title: d.title, reason: `${Math.round(distance)}° away · ${placeConnectionReason(d, distance)}`, strength: Math.max(1, Math.round(100 - distance)) }));
      setActive({
        id: `place-${point.lat.toFixed(2)}-${point.lon.toFixed(2)}`, template: 'atmosphere', title: `A live pulse from ${place.label}`, kicker: 'You found this place', visual: place.country ? 'city' : 'ocean', score: 72, freshness: 'current conditions',
        location: { lat: point.lat, lon: point.lon, label: place.label },
        summary: place.hook ?? 'You selected this point directly. Elsewhere is grounding it in current modeled weather, air quality and geography, then connecting it to the nearest concurrent live signals rather than pretending local events are known.',
        facts: place.facts ?? [], connections: nearest,
        mediaImage: place.mediaImage, mediaAlt: place.mediaAlt,
        sources: place.sources ?? [],
        related: ['Nearby cameras', 'Historical comparison', 'Nearby signals', 'Night lights']
      });
    } catch {
      setActive(current => current ? { ...current, title: 'This point is hard to read right now', summary: 'The public place/weather services did not answer. No local claim is made.', facts: [{ label: 'Evidence', value: 'Unavailable', kind: 'question' }] } : current);
    }
  };

  useEffect(() => {
    const openHash = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!hash) return;
      if (hash.startsWith('place=')) {
        const [hashLat, hashLon] = hash.slice(6).split(',').map(Number);
        if (Number.isFinite(hashLat) && Number.isFinite(hashLon)) void probePlace({ lat: hashLat, lon: hashLon });
        return;
      }
      const hashId = hash.replace(/^investigate-/, '');
      const targetInvestigation = investigations.find(item => item.id === hashId || `investigate-${item.id}` === hash);
      if (targetInvestigation) {
        setSelectedInvestigation(targetInvestigation);
        setMode('investigate');
        return;
      }
      if (hash.startsWith('camera-pin-')) {
        const camera = publicCameras.find(item => `camera-pin-${item.id}` === hash);
        if (camera) selectCamera(camera);
        else {
          setActive(unavailableSharedDiscovery(hash));
          setMode('discover');
          setPanelOpen(true);
        }
        return;
      }
      const targetDiscovery = discoveries.find(item => item.id === hash);
      if (targetDiscovery) selectDiscovery(targetDiscovery);
      else {
        setActive(unavailableSharedDiscovery(hash));
        setMode('discover');
        setPanelOpen(true);
      }
    };
    window.addEventListener('hashchange', openHash);
    return () => window.removeEventListener('hashchange', openHash);
  }, [discoveries, investigations]);

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
      const params = new URLSearchParams({ topic: label, label: active.location.label, subject: active.title, lat: String(active.location.lat), lon: String(active.location.lon) });
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
  const globeFocus = mode === 'investigate' && inv ? { id: inv.id, location: inv.location } : active?.unavailable ? undefined : active;

  useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    let hash = '';
    if (mode === 'investigate' && inv) hash = `investigate-${inv.id}`;
    if (mode === 'discover' && active) hash = active.id.startsWith('place-') ? `place=${active.location.lat.toFixed(4)},${active.location.lon.toFixed(4)}` : active.id;
    if (hash) window.history.replaceState(null, '', `${window.location.pathname}#${encodeURIComponent(hash)}`);
  }, [active?.id, active?.location.lat, active?.location.lon, mode, inv?.id, loading]);


  const selectInvestigation = (investigation: Investigation) => {
    setSelectedInvestigation(investigation);
    setMode('investigate');
  };

  return <main className={`mode-${mode} ${panelOpen ? 'panel-open' : 'panel-closed'}`}>
    <Globe active={globeFocus} discoveries={discoveries} investigations={investigations} cameras={publicCameras} onSelect={selectDiscovery} onSelectCamera={selectCamera} onSelectInvestigation={selectInvestigation} />
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
      <motion.p className="interactionHint">Drag Earth · tap anywhere · {cameraCoverage().total} live look-ins · follow the evidence</motion.p>
    </section>

    <div className="actionDock">
      <button className="surprise" onClick={() => surprise()} disabled={loading}><Shuffle size={20} />{loading ? 'Listening…' : 'Surprise Me'}</button>
      <button className={watching ? 'watch active' : 'watch'} onClick={() => setWatching(!watching)}><Play size={17} />{watching ? 'Watching' : 'Watch'}</button>
      <button className="share" onClick={shareCurrent} aria-label="Copy link to this view">{copied ? <Check size={17} /> : <Share2 size={17} />}{copied ? 'Copied' : 'Share'}</button>
    </div>

    <AnimatePresence mode="wait">
      {mode === 'discover' && active && panelOpen && <motion.aside key={active.id} className="discoveryPanel" initial={{ opacity: 0, y: 42, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 26, scale: .985 }} transition={{ type: 'spring', damping: 26, stiffness: 230 }}>
        <button className="panelClose" aria-label="Hide discovery" onClick={() => setPanelOpen(false)}><X size={17} /></button>
        <div className="panelMedia">{active.visual === 'nasa-live' ?
          <LiveVideo title="NASA live video" src="https://www.youtube.com/embed/ROboUHfPUrU?rel=0&autoplay=1&mute=1&playsinline=1" /> : active.mediaVideo ?
          <LiveVideo title={`${active.title} live video`} src={active.mediaVideo} autoPlay={active.id.startsWith('camera-pin-')} /> :
          <><VisualMotif kind={active.visual} />{active.mediaImage && <LiveImage src={active.mediaImage} alt={active.mediaAlt ?? active.title} />}</>}
          {active.visual !== 'nasa-live' && !active.mediaVideo && <div className="mediaTag"><Radio size={13} />{active.mediaImage ? (active.mediaImage.includes('nesdis.noaa.gov') ? 'Near-real-time satellite imagery' : 'Latest public Earth imagery') : 'Animated evidence visualization'}</div>}
        </div>
        <div className="panelBody">
          <div className="eyebrow"><Sparkles size={14} />{active.kicker}</div>
          <h2>{active.title}</h2>
          <p className="location">{locationLine}</p>
          <p className="summary">{active.summary}</p>
          <div className="factGrid">{active.facts.map(f => <div key={f.label} className={`fact ${f.kind}`}><span>{f.label}</span><strong>{f.value}</strong><em>{kindLabel[f.kind]}</em></div>)}</div>
          {path.length > 1 && <div className="evidencePath"><span>Evidence path</span><div>{path.map((d, i) => <button key={`${d.id}-${i}`} onClick={() => selectDiscovery(d, undefined, true)} className={d.id === active.id ? 'active' : ''}>{d.title}</button>)}</div></div>}
          {Boolean(active.connections?.length) && <div className="connections"><span>Connected signals</span>{active.connections?.map(c => <button key={c.id} onClick={() => followConnection(c.id)}><b>{c.title}</b><small>{c.reason}</small></button>)}</div>}
          {Boolean(active.related.length) && <div className="rabbit"><span>Explore further</span>{active.related.map(r => <button key={r} onClick={() => exploreRelated(r)}>{r}<ArrowRight size={13} /></button>)}</div>}
          {lensLoading && <div className="contextLens"><b>Reading local evidence…</b></div>}
          {lens && <div className="contextLens"><b>{lens.topic}</b>{lens.retrievedAt && <small className="lensTime">retrieved {new Date(lens.retrievedAt).toLocaleTimeString()}</small>}{Boolean(lens.videos?.length) && <CameraLookins videos={lens.videos} />}<div className="lensGrid">{lens.facts?.map((f: any) => <div key={f.label} className={`lensFact ${f.kind}`}><span>{f.label}</span><p>{f.value}</p></div>)}</div></div>}
          <details className="sources"><summary>Evidence and sources</summary>{active.sources.map(s => <a key={s.url} href={s.url} target="_blank">{s.label}<small>{new Date(s.retrievedAt).toLocaleTimeString()}</small></a>)}</details>
        </div>
      </motion.aside>}

      {mode === 'investigate' && inv && <motion.aside key={inv.id} className="discoveryPanel investigation" initial={{ opacity: 0, y: 42 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 26 }}>
        {inv.mediaImage && <div className="panelMedia"><VisualMotif kind="orbital" /><LiveImage src={inv.mediaImage} alt={inv.mediaAlt ?? inv.title} /><div className="mediaTag"><Satellite size={13} /> {inv.mediaImage.includes('nesdis.noaa.gov') ? 'Near-real-time satellite imagery' : 'Latest satellite swath'}</div></div>}
        <div className="panelBody investigationBody">
        <div className="investHeader"><div><div className="eyebrow"><Eye size={14} />Beyond the headlines</div><h2>{inv.title}</h2><p className="location">{inv.location.label} · confidence {inv.confidence}%</p></div><button onClick={() => setMode('discover')}><X size={18} /></button></div>
        <p className="summary">{inv.dek}</p>
        {Boolean(inv.visuals?.length) && <div className="signalBars"><div className="signalBarsHeader"><span>{inv.visualTitle ?? 'Live evidence comparison'}</span><small>{inv.visualCaption ?? 'current public data'}</small></div>{inv.visuals?.map(v => {
          const max = Math.max(...(inv.visuals ?? []).map(item => item.value), 1);
          return <div key={v.label} className={v.highlight ? 'signalBar highlight' : 'signalBar'}><span>{v.label}</span><div><i style={{ width: `${Math.max(2, Math.round(v.value / max * 100))}%` }} /></div><b>{v.display}</b></div>;
        })}</div>}
        {Boolean(inv.pulses?.length) && <div className="pulseBlock"><div className="signalBarsHeader"><span>{inv.pulseTitle ?? 'Signal cadence'}</span><small>{inv.pulseCaption ?? 'oldest → latest'}</small></div>{inv.pulses?.map(row => {
          const max = Math.max(...row.values, 1);
          return <div key={row.label} className="pulseRow"><span>{row.label}</span><div className="pulseColumns">{row.values.map((value, index) => <i key={index} style={{ height: `${Math.max(8, Math.round(value / max * 100))}%` }} title={`${value} sampled items`} />)}</div><b>{row.display}</b></div>;
        })}</div>}
        <div className="factGrid metrics">{inv.metrics.map(m => <div key={m.label} className="fact"><span>{m.label}</span><strong>{m.value}</strong><em>{m.delta}</em></div>)}</div>
        <div className="evidence">{inv.evidence.slice(0, 5).map((e, i) => <div key={i} className={`line ${e.kind}`}><b>{kindLabel[e.kind]}</b><p>{e.text}</p></div>)}</div>
        {inv.evidence.length > 5 && <details className="moreEvidence"><summary>Deeper evidence and caveats · {inv.evidence.length - 5} more</summary><div className="evidence">{inv.evidence.slice(5).map((e, i) => <div key={i + 5} className={`line ${e.kind}`}><b>{kindLabel[e.kind]}</b><p>{e.text}</p></div>)}</div></details>}
        <details className="sources" open><summary>Sources</summary>{inv.sources.map(s => <a key={s.url} href={s.url} target="_blank">{s.label}</a>)}</details>
        </div>
      </motion.aside>}
    </AnimatePresence>

    {mode === 'investigate' && investigations.length > 1 && <div className="investRail">{investigations.map(i => <button key={i.id} onClick={() => setSelectedInvestigation(i)} className={i.id === inv?.id ? 'active' : ''}>{i.title}</button>)}</div>}
    {mode === 'discover' && active && !panelOpen && <button className="reopen" onClick={() => setPanelOpen(true)}>{active.kicker}</button>}
    {loading && <div className="loading"><Loader2 className="spin" />Listening to public Earth signals…</div>}
    {!loading && !discoveries.length && <div className="emptyState"><b>Earth signals are temporarily quiet</b><span>Public feeds did not answer. Elsewhere will retry automatically without inventing evidence.</span></div>}
  </main>;
}


function LiveVideo({ src, title, autoPlay = false }: { src: string; title: string; autoPlay?: boolean }) {
  const [playing, setPlaying] = useState(autoPlay);
  useEffect(() => setPlaying(autoPlay), [src, autoPlay]);
  const id = src.match(/embed\/([^?]+)/)?.[1];
  if (playing || !id) return <iframe title={title} src={src} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  return <button className="videoPoster" onClick={() => setPlaying(true)} aria-label={`Play ${title}`}>
    <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" />
    <span><Play size={18} />Open live stream</span>
  </button>;
}

function CameraLookins({ videos }: { videos: any[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [videos]);
  const current = videos[Math.min(index, videos.length - 1)];
  if (!current) return null;
  return <div className="cameraLookins">
    <div className="lensVideo">{current.src ? <LiveVideo title={`${current.title} live look-in`} src={current.src} autoPlay /> : <LiveImage src={current.image} alt={`${current.title} live camera image`} />}</div>
    <div className="cameraChoices">{videos.map((video, videoIndex) => <button key={video.youtubeId ?? video.title} onClick={() => setIndex(videoIndex)} className={videoIndex === index ? 'active' : ''}><b>{video.place}</b><small>{video.approximate ? '~' : ''}{video.distance} km away{video.image ? ' · live image' : ''}{video.confidence === 'low' ? ' · verify' : ''}</small></button>)}</div>
    {(current.youtubeId || current.sourceUrl) && <a className="cameraSourceLink" href={current.youtubeId ? `https://www.youtube.com/watch?v=${current.youtubeId}` : current.sourceUrl} target="_blank">Open source camera directly</a>}
  </div>;
}

function LiveImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return null;
  return <img
    className="liveImage"
    src={src}
    alt={alt}
    crossOrigin="anonymous"
    onError={() => setFailed(true)}
    onLoad={event => {
      try {
        const image = event.currentTarget;
        const canvas = document.createElement('canvas');
        canvas.width = 40; canvas.height = 24;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0, lit = 0;
        for (let index = 0; index < data.length; index += 4) {
          const luminance = data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722;
          total += luminance;
          if (luminance > 24) lit += 1;
        }
        const pixels = data.length / 4;
        if (total / pixels < 5 && lit / pixels < .01) setFailed(true);
      } catch { /* imagery without readable pixels remains visible */ }
    }}
  />;
}

function VisualMotif({ kind }: { kind: Discovery['visual'] }) {
  return <div className={`motif ${kind}`} aria-hidden="true">
    {kind === 'aurora' && <><i className="ribbon a" /><i className="ribbon b" /><i className="ribbon c" /><div className="horizon" /></>}
    {kind === 'seismic' && <><i className="epicenter" /><i className="shock s1" /><i className="shock s2" /><svg className="wave" viewBox="0 0 420 100"><path d="M0 52 L82 52 L101 18 L123 86 L147 31 L168 52 L420 52" /></svg></>}
    {kind === 'fire' && <><div className="fireGlow" /><i className="smoke sm1" /><i className="smoke sm2" /><i className="smoke sm3" /><i className="flameCore" /><div className="ridge" />{Array.from({ length: 18 }, (_, i) => <i key={i} className="ember" style={{ left: `${7 + i * 5}%`, animationDelay: `${(i % 7) * .42}s` }} />)}</>}
    {kind === 'launch' && <><svg className="trajectory" viewBox="0 0 420 180"><path d="M35 172 C120 145 190 92 376 20" /></svg><i className="rocket" /><i className="flame" /><div className="pad" /></>}
    {kind === 'ocean' && <><i className="moon" />{Array.from({ length: 4 }, (_, i) => <i key={i} className={`swell w${i + 1}`} />)}<div className="beam" /></>}
    {kind === 'storm' && <><i className="stormCloud sc1" /><i className="stormCloud sc2" /><i className="lightningBolt" />{Array.from({ length: 14 }, (_, i) => <i key={i} className="raindrop" style={{ left: `${16 + i * 5}%`, animationDelay: `${(i % 6) * .18}s` }} />)}<div className="stormHorizon" /></>}
    {kind === 'city' && <><i className="sunrise" /><div className="skyline">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ height: `${24 + (i * 17) % 58}px` }} />)}</div></>}
    {(kind === 'orbital' || kind === 'nasa-live') && <><i className="orbitLine" /><i className="satelliteDot" /><i className="scan" /></>}
    {!['aurora','seismic','fire','launch','ocean','storm','city','orbital','nasa-live'].includes(kind) && <><div className="pulse" /><div className="ring r1" /><div className="ring r2" /></>}
  </div>;
}
