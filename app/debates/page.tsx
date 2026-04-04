'use client';

import { DebateList } from '@/components/debates';
import { Navbar } from '@/components/ui/navbar';

export const dynamic = 'force-dynamic';

export default function DebatesPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col">
        <div className="flex-1 container mx-auto px-4 py-4 md:py-6 lg:py-8">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Browse Debates</h1>
              <p className="text-sm md:text-base lg:text-lg text-muted-foreground">
                Explore ongoing debates and join the discussion
              </p>
            </div>

            <DebateList />
          </div>
        </div>

        <footer className="border-t py-4 md:py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
            <p>Powered by GenLayer</p>
          </div>
        </footer>
      </main>
    </>
  );
}
