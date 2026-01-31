'use client';

import { DebateList } from '@/components/debates';
import { Navbar } from '@/components/ui/navbar';

export const dynamic = 'force-dynamic';

/**
 * Debates list page
 * Displays all debates with filtering by status
 */
export default function DebatesPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col">
        {/* Main Content */}
        <div className="flex-1 container mx-auto px-4 py-4 md:py-6 lg:py-8">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            {/* Page Title */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">Browse Debates</h1>
              <p className="text-sm md:text-base lg:text-lg text-muted-foreground">
                Explore ongoing debates and join the discussion
              </p>
            </div>

            {/* Debate List */}
            <DebateList />
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t py-4 md:py-6 mt-auto">
          <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
            <p>Powered by GenLayer</p>
          </div>
        </footer>
      </main>
    </>
  );
}
