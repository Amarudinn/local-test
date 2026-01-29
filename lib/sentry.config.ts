/**
 * Sentry configuration for error tracking and performance monitoring
 * This file should be imported in the root layout or _app file
 */

// Uncomment and configure when ready to use Sentry
/*
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Environment
      environment: process.env.NODE_ENV,
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Integrations
      integrations: [
        new Sentry.BrowserTracing({
          // Set sampling rate for performance monitoring
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/studio\.genlayer\.com/,
            /^https:\/\/.*\.supabase\.co/,
          ],
        }),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Filter out certain errors
      beforeSend(event, hint) {
        // Filter out network errors that are expected
        const error = hint.originalException;
        if (error && typeof error === 'object' && 'message' in error) {
          const message = String(error.message);
          
          // Ignore user-cancelled transactions
          if (message.includes('User rejected') || message.includes('User denied')) {
            return null;
          }
          
          // Ignore expected network timeouts
          if (message.includes('timeout') && message.includes('expected')) {
            return null;
          }
        }
        
        return event;
      },
      
      // Add custom tags
      initialScope: {
        tags: {
          app: 'ruang-debat',
        },
      },
    });
  }
}

// Helper to set user context
export function setSentryUser(userAddress: string, email?: string) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser({
      id: userAddress,
      email,
    });
  }
}

// Helper to clear user context on logout
export function clearSentryUser() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

// Helper to add breadcrumb
export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}
*/

// Placeholder exports when Sentry is not configured
export function initSentry() {
  console.log('[Monitoring] Sentry not configured. Set NEXT_PUBLIC_SENTRY_DSN to enable.');
}

export function setSentryUser(userAddress: string, email?: string) {
  // No-op when Sentry is not configured
}

export function clearSentryUser() {
  // No-op when Sentry is not configured
}

export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
) {
  // No-op when Sentry is not configured
}
