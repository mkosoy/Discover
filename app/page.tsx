import DiscoverApp from '@/components/DiscoverApp';
import type { Metadata } from 'next';
import { getInvestigations, getDiscoveries } from '@/lib/live';
import { publicCameras } from '@/lib/cameras';

// Shared links carry ?d=<discovery-or-investigation-id>; resolve them into rich social previews.
// Cached briefly in-process because getDiscoveries hits upstream feeds.
let metaCache: { at: number; discoveries: any[]; investigations: any[] } = { at: 0, discoveries: [], investigations: [] };
async function catalog() {
  if (Date.now() - metaCache.at < 600000 && (metaCache.discoveries.length || metaCache.investigations.length)) return metaCache;
  try {
    const [discoveries, investigations] = await Promise.all([getDiscoveries().catch(() => []), getInvestigations().catch(() => [])]);
    metaCache = { at: Date.now(), discoveries: discoveries ?? [], investigations: investigations ?? [] };
  } catch { /* serve generic metadata */ }
  return metaCache;
}

export async function generateMetadata({ searchParams }: { searchParams: { d?: string } }): Promise<Metadata> {
  const id = searchParams?.d ? decodeURIComponent(searchParams.d) : '';
  if (!id) return {};
  const { discoveries, investigations } = await catalog();
  const invId = id.replace(/^investigate-/, '');
  const inv = investigations.find((item: any) => item.id === invId);
  let disc = discoveries.find((item: any) => item.id === id);
  if (!disc && id.startsWith('camera-')) {
    const cam = publicCameras.find((item: any) => `camera-${item.id}` === id || `camera-pin-${item.id}` === id);
    if (cam) disc = { title: `${cam.title} — live look-in`, summary: `A live public camera in ${cam.place}, one of hundreds of look-ins across the planet on Elsewhere.` } as any;
  }
  const title = inv?.title ?? disc?.title ?? 'A live moment on Earth';
  const description = inv?.dek ?? disc?.summary ?? "Discover what is happening. Understand what it means.";
  const image = disc?.mediaImage;
  return {
    title: `${title} — Elsewhere`,
    openGraph: {
      title,
      description: typeof description === 'string' ? description.slice(0, 240) : undefined,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined
    },
    twitter: { card: 'summary_large_image', title, description: typeof description === 'string' ? description.slice(0, 200) : undefined, images: image ? [image] : undefined }
  };
}

export default function Page() { return <DiscoverApp />; }
