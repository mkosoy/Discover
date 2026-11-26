'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Compass, Eye, Globe2, Loader2, Newspaper, Play, Radio, Shuffle, Sparkles, X } from 'lucide-react';
import Globe from './Globe';
import type { Discovery, Investigation } from '@/lib/types';

const kindLabel = { observed: 'Observed', verified: 'Verified report', interpretation: 'Interpretation', prediction: 'Prediction', question: 'Open question' } as const;

export default function DiscoverApp() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [active, setActive] = useState<Discovery>();
  const [mode, setMode] = useState<'discover' | 'investigate'>('discover');
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation>();
  const [watching, setWatching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/discoveries').then(r => r.json()).catch(() => ({ discoveries: [] })),
      fetch('/api/investigations').then(r => r.json()).catch(() => ({ investigations: [] }))
    ]).then(([d, i]) => {
      setDiscoveries(d.discoveries ?? []);
      setInvestigations(i.investigations ?? []);
      setActive((d.discoveries ?? [])[0]);
      setSelectedInvestigation((i.investigations ?? [])[0]);
      setLoading(false);
    });
  }, []);

  const surprise = () => {
    if (!discoveries.length) return;
    const pool = discoveries.filter(d => d.id !== active?.id);
    setActive(pool[Math.floor(Math.random() * pool.length)] ?? discoveries[0]);
    setPanelOpen(true);
    setMode('discover');
  };

  useEffect(() => {
    if (!watching || discoveries.length < 2) return;
    const timer = window.setInterval(surprise, 11000);
    return () => window.clearInterval(timer);
  });

  const locationLine = useMemo(() => active ? `${active.location.label} · ${active.freshness}` : 'Reading live Earth signals', [active]);
  const inv = selectedInvestigation ?? investigations[0];

  return <main>
    <Globe active={active} discoveries={discoveries} />
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
    </section>

    <div className="actionDock">
      <button className="surprise" onClick={surprise} disabled={loading}><Shuffle size={20} />{loading ? 'Listening…' : 'Surprise Me'}</button>
      <button className={watching ? 'watch active' : 'watch'} onClick={() => setWatching(!watching)}><Play size={17} />{watching ? 'Watching' : 'Watch'}</button>
    </div>

    <AnimatePresence mode="wait">
      {mode === 'discover' && active && panelOpen && <motion.aside key={active.id} className="discoveryPanel" initial={{ opacity: 0, y: 42, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 26, scale: .985 }} transition={{ type: 'spring', damping: 26, stiffness: 230 }}>
        <button className="panelClose" aria-label="Hide discovery" onClick={() => setPanelOpen(false)}><X size={17} /></button>
        <div className="panelMedia">{active.visual === 'nasa-live' ?
          <iframe title="NASA live video" src="https://www.youtube.com/embed/ROboUHfPUrU?rel=0" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /> :
          <VisualMotif kind={active.visual} />}
          <div className="mediaTag"><Radio size={13} />{active.visual === 'nasa-live' ? 'Official live video' : 'Animated evidence visualization'}</div>
        </div>
        <div className="panelBody">
          <div className="eyebrow"><Sparkles size={14} />{active.kicker}</div>
          <h2>{active.title}</h2>
          <p className="location">{locationLine}</p>
          <p className="summary">{active.summary}</p>
          <div className="factGrid">{active.facts.map(f => <div key={f.label} className={`fact ${f.kind}`}><span>{f.label}</span><strong>{f.value}</strong><em>{kindLabel[f.kind]}</em></div>)}</div>
          <div className="rabbit"><span>Explore further</span>{active.related.map(r => <button key={r}>{r}<ArrowRight size={13} /></button>)}</div>
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

function VisualMotif({ kind }: { kind: Discovery['visual'] }) {
  return <div className={`motif ${kind}`}><div className="pulse" /><div className="ring r1" /><div className="ring r2" /><span>{kind === 'seismic' ? 'M' : kind === 'aurora' ? 'Kp' : kind === 'fire' ? 'IR' : kind === 'launch' ? 'T−' : 'SIG'}</span></div>;
}
