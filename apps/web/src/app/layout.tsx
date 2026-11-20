import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vichith Clipper — Open-Source AI Video Clipper (9:16 Shorts)',
  description:
    'Turn long stream captures and VODs into viral 9:16 vertical shorts with automated gaming facecam split, kinetic captions, and multi-track NLE timeline export.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#060707] text-[#F5F6F5] antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
