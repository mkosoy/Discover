import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Elsewhere — Discover what\'s happening',
  description: 'Discover what\'s happening. Understand what it means. A cinematic live discovery platform for Earth.',
  applicationName: 'Elsewhere',
  appleWebApp: { capable: true, title: 'Elsewhere', statusBarStyle: 'black-translucent' },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  openGraph: {
    title: 'Elsewhere — Discover what\'s happening. Understand what it means.',
    description: 'A live discovery platform for Earth: real-time cameras across 122 countries, satellite imagery, earthquakes, volcanoes, auroras, launches and investigations that connect them.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Elsewhere live Earth — Mount Etna venting on a live camera' }],
    type: 'website'
  },
  twitter: { card: 'summary_large_image', title: 'Elsewhere — Discover what\'s happening', description: 'Live cameras, satellites and investigations across the whole planet, right now.', images: ['/og-image.png'] }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#02040c' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head>
    <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('error',function(e){var m=String((e.error&&e.error.message)||e.message||'');if(/ChunkLoadError|Loading chunk \\d+ failed/.test(m)&&!sessionStorage.getItem('chunk-reload')){sessionStorage.setItem('chunk-reload','1');location.reload();}},true);` }} />
  </head><body>{children}</body></html>;
}
