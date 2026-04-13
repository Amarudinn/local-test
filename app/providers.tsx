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
import { InstallPWA } from '@/components/ui/install-pwa';
import { isRetryable, classifyError, ErrorType } from '@/lib/error-handler';

interface ProvidersProps {
  children: React.ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const errorInfo = classifyError(error);
        if (errorInfo.type === ErrorType.VALIDATION) {
          return false;
        }
        
        if (
          errorInfo.type === ErrorType.NETWORK ||
          errorInfo.type === ErrorType.DATABASE
        ) {
          return failureCount < 3;
        }
        
        return false;
      },
      retryDelay: (attemptIndex) => {
        return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        const errorInfo = classifyError(error);
        if (errorInfo.type === ErrorType.NETWORK && failureCount < 2) {
          return true;
        }
        return false;
      },
      retryDelay: 1000,
    },
  },
});

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        initSentry();
        logger.info(LogCategory.UI, 'Sentry initialized');

        if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
          analytics.init();
          logger.info(LogCategory.UI, 'Analytics initialized');
        }

        if (process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true') {
          performanceMonitor.trackWebVitals();
          logger.info(LogCategory.UI, 'Performance monitoring initialized');
        }

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
          <InstallPWA />
        </QueryClientProvider>
      </PrivyProviderWrapper>
    </ErrorBoundary>
  );
}

