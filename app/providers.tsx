/**
 * Root providers component that wraps the entire application
 * Includes monitoring, analytics, error tracking, authentication, and data fetching
 */

'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/lib/error-boundary';
import { initSentry } from '@/lib/sentry.config';
import { analytics } from '@/lib/analytics';
import { performanceMonitor } from '@/lib/monitoring';
import { logger, LogCategory } from '@/lib/logger';
import { PrivyProviderWrapper } from './privy-provider-wrapper';
import { AuthSyncHandler } from '@/components/auth/AuthSyncHandler';
import { GenLayerSignerHandler } from '@/components/auth/GenLayerSignerHandler';
import { isRetryable, classifyError, ErrorType } from '@/lib/error-handler';

interface ProvidersProps {
  children: React.ReactNode;
}

// Create a client for TanStack Query with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry validation errors
        const errorInfo = classifyError(error);
        if (errorInfo.type === ErrorType.VALIDATION) {
          return false;
        }
        
        // Retry network and database errors up to 3 times
        if (
          errorInfo.type === ErrorType.NETWORK ||
          errorInfo.type === ErrorType.DATABASE
        ) {
          return failureCount < 3;
        }
        
        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s
        return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Only retry network errors for mutations
        const errorInfo = classifyError(error);
        if (errorInfo.type === ErrorType.NETWORK && failureCount < 2) {
          return true;
        }
        return false;
      },
      retryDelay: 1000, // 1 second delay for mutations
    },
  },
});

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Initialize monitoring and analytics on client side
    if (typeof window !== 'undefined') {
      try {
        // Initialize Sentry for error tracking
        initSentry();
        logger.info(LogCategory.UI, 'Sentry initialized');

        // Initialize analytics
        if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
          analytics.init();
          logger.info(LogCategory.UI, 'Analytics initialized');
        }

        // Initialize performance monitoring
        if (process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true') {
          performanceMonitor.trackWebVitals();
          logger.info(LogCategory.UI, 'Performance monitoring initialized');
        }

        // Track initial page load
        performanceMonitor.trackPageLoad(window.location.pathname);
      } catch (error) {
        console.error('Failed to initialize monitoring:', error);
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <PrivyProviderWrapper>
        <QueryClientProvider client={queryClient}>
          <AuthSyncHandler />
          <GenLayerSignerHandler />
          {children}
        </QueryClientProvider>
      </PrivyProviderWrapper>
    </ErrorBoundary>
  );
}
