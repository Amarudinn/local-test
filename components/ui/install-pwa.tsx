'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Extend the global interfaces for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 1 * 24 * 60 * 60 * 1000; // 1 day

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
  if (!dismissed) return false;
  const dismissedAt = parseInt(dismissed, 10);
  const now = Date.now();
  return (now - dismissedAt) < DISMISS_DURATION_MS;
}

function setDismissed(): void {
  localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    if (isStandalone()) return;
    // Don't show if recently dismissed
    if (isDismissed()) return;

    // iOS detection — no beforeinstallprompt, show manual guide
    if (isIOS()) {
      setShowIOSGuide(true);
      // Delay animation
      setTimeout(() => setIsVisible(true), 300);
      return;
    }

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
      // Delay animation
      setTimeout(() => setIsVisible(true), 300);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowBanner(false);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Wait for exit animation before removing from DOM
    setTimeout(() => {
      setShowBanner(false);
      setShowIOSGuide(false);
      setDismissed();
    }, 400);
  }, []);

  // Nothing to show
  if (!showBanner && !showIOSGuide) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100] p-4 transition-all duration-500 ease-out',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0'
      )}
    >
      <div className="container mx-auto max-w-lg">
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border',
            'bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80',
            'shadow-[0_-4px_40px_rgba(59,130,246,0.15)]',
            'border-primary/20'
          )}
        >
          {/* Gradient accent top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-400" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className={cn(
              'absolute top-3 right-3 p-1.5 rounded-full',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-muted/80 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-5 pt-6">
            {/* iOS Guide */}
            {showIOSGuide && (
              <div className="flex items-start gap-4">
                {/* App icon */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
                  <img
                    src="/icons/icon-96x96.png"
                    alt="App Icon"
                    className="w-10 h-10 object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    Install Debate Room
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Tap{' '}
                    <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                      <Share className="h-3 w-3" /> Share
                    </span>{' '}
                    then select{' '}
                    <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                      <Plus className="h-3 w-3" /> Add to Home Screen
                    </span>
                  </p>

                  {/* Step indicators */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</span>
                      <Share className="h-3 w-3" />
                      Share
                    </div>
                    <svg className="h-3 w-3 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                      <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</span>
                      <Plus className="h-3 w-3" />
                      Add
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chrome / Standard Install Banner */}
            {showBanner && !showIOSGuide && (
              <div className="flex items-center gap-4">
                {/* App icon */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
                  <img
                    src="/icons/icon-96x96.png"
                    alt="App Icon"
                    className="w-10 h-10 object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">
                    Install Debate Room
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Quick access directly from your home screen
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleInstall}
                      disabled={isInstalling}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold',
                        'bg-primary text-primary-foreground',
                        'hover:bg-primary/90 active:scale-[0.98]',
                        'transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                        'shadow-md shadow-primary/25'
                      )}
                    >
                      <Download className={cn('h-3.5 w-3.5', isInstalling && 'animate-bounce')} />
                      {isInstalling ? 'Installing...' : 'Install'}
                    </button>

                    <button
                      onClick={handleDismiss}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium',
                        'text-muted-foreground hover:text-foreground',
                        'hover:bg-muted/80 transition-colors'
                      )}
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
