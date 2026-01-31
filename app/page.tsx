'use client';

import { useRouter } from 'next/navigation';
import { LoginButton, UserProfile } from '@/components/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';

import { Navbar } from '@/components/ui/navbar';

export const dynamic = 'force-dynamic';

export default function Home() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col">
      {/* Shared Navbar */}
      <Navbar />

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl w-full text-center space-y-4 md:space-y-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Welcome to Debate Room
          </h2>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground px-2">
            A decentralized debate platform powered by GenLayer
          </p>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground px-2">
            Create debate rooms, submit arguments, and have AI judges determine winners
          </p>

          {/* Authentication Status */}
          <div className="pt-6 md:pt-8">
            {isLoading && (
              <p className="text-sm md:text-base text-muted-foreground">Loading authentication...</p>
            )}
            {!isLoading && !isAuthenticated && (
              <div className="space-y-4">
                <p className="text-sm md:text-base text-muted-foreground px-2">
                  Get started by logging in with your preferred method
                </p>
                <LoginButton size="lg" />
              </div>
            )}
            {!isLoading && isAuthenticated && user && (
              <div className="space-y-4 px-2">
                {/* Content simplified: Auth details hidden as they are in Navbar */}
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mt-4">
                  <Button
                    size="lg"
                    onClick={() => router.push('/debates')}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Browse Debates
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => router.push('/debates/create')}
                    className="w-full sm:w-auto"
                  >
                    Create Debate
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pt-8 md:pt-12 px-2">
            <div className="p-4 md:p-6 border rounded-lg hover:shadow-md transition-shadow">
              <h3 className="text-base md:text-lg font-semibold mb-2">Create Debates</h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Start a new debate on any topic with customizable rules
              </p>
            </div>
            <div className="p-4 md:p-6 border rounded-lg hover:shadow-md transition-shadow">
              <h3 className="text-base md:text-lg font-semibold mb-2">Submit Arguments</h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Participate with your best arguments on-chain
              </p>
            </div>
            <div className="p-4 md:p-6 border rounded-lg hover:shadow-md transition-shadow">
              <h3 className="text-base md:text-lg font-semibold mb-2">AI Judging</h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                Fair and transparent evaluation by AI
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-4 md:py-6">
        <div className="container mx-auto px-4 text-center text-xs md:text-sm text-muted-foreground">
          <p>Powered by GenLayer</p>
        </div>
      </footer>
    </main >
  );
}
