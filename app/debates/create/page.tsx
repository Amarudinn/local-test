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
    </>
  );
}
