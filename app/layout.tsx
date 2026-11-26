import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Elsewhere — Discover what\'s happening',
  description: 'Discover what\'s happening. Understand what it means. A cinematic live discovery platform for Earth.',
  applicationName: 'Elsewhere',
  appleWebApp: { capable: true, title: 'Elsewhere', statusBarStyle: 'black-translucent' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#02040c' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
