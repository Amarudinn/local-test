import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/lib/error-boundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Debate Room - Decentralized Debate Platform',
  description: 'Create debate rooms, submit arguments, and have AI judges determine winners on the blockchain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>{children}</Providers>
          <Toaster position="bottom-right" richColors />
        </ErrorBoundary>
      </body>
    </html>
  );
}
