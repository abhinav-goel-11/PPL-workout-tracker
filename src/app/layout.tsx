import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'PPL Tracker',
    template: '%s · PPL Tracker',
  },
  description: 'Rolling 6-session Push/Pull/Legs body-recomposition tracker.',
  appleWebApp: {
    capable: true,
    title: 'PPL',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Stops iOS auto-zooming when focusing the weight/reps number inputs mid-set.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className='bg-background text-foreground flex min-h-full flex-col'>
        {children}
        <Toaster position='top-center' richColors closeButton />
      </body>
    </html>
  );
}
