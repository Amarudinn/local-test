'use client';

import { CreateDebateForm } from '@/components/debates';
import { Navbar } from '@/components/ui/navbar';

export default function CreateDebatePage() {
  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <CreateDebateForm />
      </div>

      <footer className="border-t py-4 md:py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
          <p>Powered by GenLayer</p>
        </div>
      </footer>
    </>
  );
}
