import DiscoverApp from '@/components/DiscoverApp';
import type { Metadata } from 'next';
import { getInvestigations, getDiscoveries } from '@/lib/live';
import { publicCameras } from '@/lib/cameras';

// Shared links carry ?d=<discovery-or-investigation-id>; resolve them into rich social previews.
// Cached briefly in-process because getDiscoveries hits upstream feeds. The in-flight promise is
// shared so concurrent crawler misses can't multiply upstream requests, and empty results are
// cached (shorter TTL) so an unknown-id spray doesn't hammer feeds either.
let metaCache: { at: number; discoveries: any[]; investigations: any[] } = { at: 0, discoveries: [], investigations: [] };
let inflight: Promise<typeof metaCache> | null = null;
async function catalog() {
  const fresh = metaCache.discoveries.length || metaCache.investigations.length;
  const ttl = fresh ? 600000 : 60000;
  if (Date.now() - metaCache.at < ttl && (fresh || metaCache.at)) return metaCache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const [discoveries, investigations] = await Promise.all([getDiscoveries().catch(() => []), getInvestigations().catch(() => [])]);
        metaCache = { at: Date.now(), discoveries: discoveries ?? [], investigations: investigations ?? [] };
      } catch { /* serve generic metadata */ }
      finally { inflight = null; }
      return metaCache;
    })();
  }
  return inflight;
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
