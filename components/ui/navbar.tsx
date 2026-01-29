'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoginButton, UserProfile } from '@/components/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Home, MessageSquare, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/debates', label: 'Browse', icon: MessageSquare },
    { href: '/debates/create', label: 'Create', icon: PlusCircle },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl hidden sm:inline-block">Ruang Debat</span>
            <span className="font-bold text-xl sm:hidden">RD</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => router.push(item.href)}
                  className={cn(
                    'gap-2',
                    isActive && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}

            {/* Auth Section */}
            <div className="ml-2 pl-2 border-l">
              {isAuthenticated ? <UserProfile /> : <LoginButton />}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
