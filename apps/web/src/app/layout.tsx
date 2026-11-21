import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://clipper.vichith.in'),
  title: 'Vichith Clipper — Open-Source AI Video Clipper (9:16 Shorts)',
  description:
    'Turn long stream captures and VODs into viral 9:16 vertical shorts with automated gaming facecam split, kinetic captions, and multi-track NLE timeline export.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo_square.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Vichith Clipper',
    description: 'Open-Source AI Video Clipper — Turn Long Streams & VODs into 9:16 Shorts',
    images: [{ url: '/logo_square.png', width: 512, height: 512, alt: 'Vichith' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo_square.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full bg-[#060707] text-[#F5F6F5] antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
