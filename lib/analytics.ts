/**
 * Analytics tracking for user behavior and platform metrics
 * Supports multiple analytics providers (Google Analytics, Mixpanel, etc.)
 */

import { logger, LogCategory } from './logger';

export enum AnalyticsEvent {
  // Authentication events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  
  // Debate events
  DEBATE_CREATED = 'debate_created',
  DEBATE_VIEWED = 'debate_viewed',
  DEBATE_JOINED = 'debate_joined',
  DEBATE_RESOLVED = 'debate_resolved',
  
  // Argument events
  ARGUMENT_SUBMITTED = 'argument_submitted',
  ARGUMENT_VIEWED = 'argument_viewed',
  
  // Leaderboard events
  LEADERBOARD_VIEWED = 'leaderboard_viewed',
  
  // Error events
  ERROR_OCCURRED = 'error_occurred',
  TRANSACTION_FAILED = 'transaction_failed',
  
  // Performance events
  PAGE_LOAD = 'page_load',
  SLOW_OPERATION = 'slow_operation',
}

interface AnalyticsProperties {
  [key: string]: string | number | boolean | undefined;
}

class Analytics {
  private isInitialized = false;

  /**
   * Initialize analytics providers
   */
  init(): void {
    if (typeof window === 'undefined') return;
    
    // Initialize Google Analytics
    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      this.initGoogleAnalytics();
    }
    
    // Initialize other analytics providers here
    // Example: Mixpanel, Amplitude, etc.
    
    this.isInitialized = true;
    logger.info(LogCategory.UI, 'Analytics initialized');
  }

  /**
   * Initialize Google Analytics
   */
  private initGoogleAnalytics(): void {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (!measurementId) return;

    // Load gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;

    gtag('js', new Date());
    gtag('config', measurementId, {
      page_path: window.location.pathname,
    });
  }

  /**
   * Track an event
   */
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.init();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug(LogCategory.UI, `Analytics event: ${event}`, {
        metadata: properties,
      });
    }

    // Send to Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, properties);
    }

    // Send to other analytics providers here
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string): void {
    this.track(AnalyticsEvent.PAGE_LOAD, {
      page_path: path,
      page_title: title || document.title,
    });
  }

  /**
   * Identify user (for user-specific analytics)
   */
  identify(userAddress: string, properties?: AnalyticsProperties): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('set', 'user_properties', {
        user_address: userAddress,
        ...properties,
      });
    }

    logger.info(LogCategory.UI, 'User identified for analytics', {
      userAddress,
      metadata: properties,
    });
  }

  /**
   * Clear user identification (on logout)
   */
  clearIdentity(): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('set', 'user_properties', {
        user_address: undefined,
      });
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Convenience functions for common events
export const trackAuth = {
  login: (userAddress: string, method: string) =>
    analytics.track(AnalyticsEvent.USER_LOGIN, {
      user_address: userAddress,
      method,
    }),
  logout: (userAddress: string) =>
    analytics.track(AnalyticsEvent.USER_LOGOUT, {
      user_address: userAddress,
    }),
};

export const trackDebate = {
  created: (contractAddress: string, topic: string, durationMinutes: number) =>
    analytics.track(AnalyticsEvent.DEBATE_CREATED, {
      contract_address: contractAddress,
      topic,
      duration_minutes: durationMinutes,
    }),
  viewed: (contractAddress: string, status: string) =>
    analytics.track(AnalyticsEvent.DEBATE_VIEWED, {
      contract_address: contractAddress,
      status,
    }),
  joined: (contractAddress: string, userAddress: string) =>
    analytics.track(AnalyticsEvent.DEBATE_JOINED, {
      contract_address: contractAddress,
      user_address: userAddress,
    }),
  resolved: (contractAddress: string, participantCount: number, duration: number) =>
    analytics.track(AnalyticsEvent.DEBATE_RESOLVED, {
      contract_address: contractAddress,
      participant_count: participantCount,
      resolution_duration_ms: duration,
    }),
};

export const trackArgument = {
  submitted: (contractAddress: string, userAddress: string, length: number) =>
    analytics.track(AnalyticsEvent.ARGUMENT_SUBMITTED, {
      contract_address: contractAddress,
      user_address: userAddress,
      argument_length: length,
    }),
};

export const trackLeaderboard = {
  viewed: (contractAddress: string, participantCount: number) =>
    analytics.track(AnalyticsEvent.LEADERBOARD_VIEWED, {
      contract_address: contractAddress,
      participant_count: participantCount,
    }),
};

export const trackError = {
  occurred: (category: string, message: string, fatal: boolean) =>
    analytics.track(AnalyticsEvent.ERROR_OCCURRED, {
      error_category: category,
      error_message: message,
      fatal,
    }),
  transactionFailed: (operation: string, reason: string) =>
    analytics.track(AnalyticsEvent.TRANSACTION_FAILED, {
      operation,
      reason,
    }),
};
