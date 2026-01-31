'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoginButton, UserProfile } from '@/components/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { Home, MessageSquare, PlusCircle, Menu, X, Info, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/debates', label: 'Browse', icon: MessageSquare },
    { href: '/debates/create', label: 'Create', icon: PlusCircle },
  ];

  const homeOnlyItems = [
    { href: '#', label: 'How it works', icon: Info },
    { href: '#', label: 'Docs', icon: FileText },
  ];

  // Normalize pathname to ensure robust homepage detection (e.g. handle trailing slashes)
  const isHomePage = pathname === '/' || pathname === '/index';

  // Desktop: Show standard links EXCEPT on Homepage
  const showDesktopStandardLinks = !isHomePage;

  const mobileItems = [...navItems, ...homeOnlyItems];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 relative">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl hidden sm:inline-block">Ruang Debat</span>
            <span className="font-bold text-xl sm:hidden">RD</span>
          </Link>

          {/* Centered Desktop Menu (Home Only) */}
          {isHomePage && (
            <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {homeOnlyItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">

            {/* Desktop Navigation (Non-Home Only) */}
            {showDesktopStandardLinks && (
              <div className="hidden md:flex items-center space-x-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Button
                      key={item.label}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => router.push(item.href)}
                      className={cn(
                        'gap-2',
                        isActive && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Auth Section */}
            <div className="pl-2 border-l ml-1">
              {isAuthenticated ? <UserProfile /> : <LoginButton />}
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden border-t py-4 px-2 space-y-2 bg-background absolute left-0 right-0 shadow-lg border-b animate-in slide-in-from-top-2">
            {mobileItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Button
                  key={item.label}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    if (item.href !== '#') router.push(item.href);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    'w-full justify-start gap-3',
                    isActive && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
