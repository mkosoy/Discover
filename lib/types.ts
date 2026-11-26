export type EvidenceKind = 'observed' | 'verified' | 'interpretation' | 'prediction' | 'question';

export type Discovery = {
  id: string;
  template: 'orbit' | 'geology' | 'atmosphere' | 'wildfire' | 'ocean' | 'city' | 'launch';
  title: string;
  kicker: string;
  summary: string;
  location: { lat: number; lon: number; label: string };
  altitude?: number;
  score: number;
  freshness: string;
  visual: 'nasa-live' | 'orbital' | 'seismic' | 'aurora' | 'fire' | 'ocean' | 'city' | 'launch';
  mediaImage?: string;
  mediaAlt?: string;
  connections?: { id: string; title: string; reason: string; strength: number }[];
  facts: { label: string; value: string; kind: EvidenceKind }[];
  sources: { label: string; url: string; retrievedAt: string }[];
  related: string[];
};

export type Investigation = {
  id: string;
  title: string;
  dek: string;
  status: 'developing' | 'corroborated' | 'uncertain';
  location: { lat: number; lon: number; label: string };
  updatedAt: string;
  confidence: number;
  evidence: { kind: EvidenceKind; text: string; source?: string }[];
  metrics: { label: string; value: string; delta?: string }[];
  sources: { label: string; url: string }[];
};
