/**
 * Monitoring and Logging - Main Export File
 * 
 * This file provides a centralized export for all monitoring and logging utilities.
 * Import from here to access all monitoring features in one place.
 * 
 * @example
 * ```typescript
 * import { logger, performanceMonitor, analytics } from '@/lib';
 * 
 * logger.info(LogCategory.UI, 'User action');
 * const endTimer = performanceMonitor.startTimer('operation');
 * analytics.track(AnalyticsEvent.DEBATE_CREATED, { ... });
 * ```
 */

// Logger exports
export {
  logger,
  LogLevel,
  LogCategory,
  logAuth,
  logBlockchain,
  logDatabase,
  logSync,
} from './logger';

// Performance monitoring exports
export {
  performanceMonitor,
  withPerformanceTracking,
  usePerformanceTracking,
} from './monitoring';

// Analytics exports
export {
  analytics,
  AnalyticsEvent,
  trackAuth,
  trackDebate,
  trackArgument,
  trackLeaderboard,
  trackError,
} from './analytics';

// Sentry exports
export {
  initSentry,
  setSentryUser,
  clearSentryUser,
  addSentryBreadcrumb,
} from './sentry.config';

// Error boundary export
export { ErrorBoundary } from './error-boundary';

// Sync service exports
export {
  syncDebateCreation,
  syncParticipantJoin,
  syncDebateResolution,
  syncDebateStatus,
} from './sync-service';
export type { DebateMetadata, ResolutionResults } from './sync-service';
