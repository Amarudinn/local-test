/**
 * Performance monitoring and metrics tracking
 * Tracks page load times, API response times, and user interactions
 */

import { logger, LogCategory } from './logger';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operationName: string): () => number {
    const startTime = performance.now();
    this.metrics.set(operationName, startTime);

    // Return a function to end the timer
    return () => this.endTimer(operationName);
  }

  /**
   * End timing an operation and log the duration
   */
  endTimer(operationName: string, metadata?: Record<string, any>): number {
    const startTime = this.metrics.get(operationName);
    if (!startTime) {
      logger.warn(
        LogCategory.PERFORMANCE,
        `Timer not found for operation: ${operationName}`
      );
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.delete(operationName);

    logger.trackPerformance(operationName, duration, { metadata });

    return duration;
  }

  /**
   * Track a custom metric
   */
  trackMetric(metric: PerformanceMetric): void {
    logger.info(LogCategory.PERFORMANCE, `Metric: ${metric.name}`, {
      metadata: {
        value: metric.value,
        unit: metric.unit,
        ...metric.metadata,
      },
    });
  }

  /**
   * Track page load performance
   */
  trackPageLoad(pageName: string): void {
    if (typeof window === 'undefined') return;

    // Use Navigation Timing API
    const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (perfData) {
      const metrics = {
        dns: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcp: perfData.connectEnd - perfData.connectStart,
        request: perfData.responseStart - perfData.requestStart,
        response: perfData.responseEnd - perfData.responseStart,
        dom: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        load: perfData.loadEventEnd - perfData.loadEventStart,
        total: perfData.loadEventEnd - perfData.fetchStart,
      };

      logger.info(LogCategory.PERFORMANCE, `Page load: ${pageName}`, {
        metadata: metrics,
      });
    }
  }

  /**
   * Track Web Vitals (Core Web Vitals)
   */
  trackWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Track Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      
      this.trackMetric({
        name: 'LCP',
        value: lastEntry.renderTime || lastEntry.loadTime,
        unit: 'ms',
        timestamp: Date.now(),
      });
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // LCP not supported
    }

    // Track First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        this.trackMetric({
          name: 'FID',
          value: entry.processingStart - entry.startTime,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // FID not supported
    }

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      this.trackMetric({
        name: 'CLS',
        value: clsValue,
        unit: 'count',
        timestamp: Date.now(),
      });
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      // CLS not supported
    }
  }

  /**
   * Track API response time
   */
  trackAPICall(
    endpoint: string,
    method: string,
    duration: number,
    status: number
  ): void {
    logger.info(LogCategory.PERFORMANCE, `API call: ${method} ${endpoint}`, {
      metadata: {
        method,
        endpoint,
        duration,
        status,
      },
    });

    // Warn on slow API calls
    if (duration > 2000) {
      logger.warn(
        LogCategory.PERFORMANCE,
        `Slow API call: ${method} ${endpoint}`,
        {
          metadata: { duration, status },
        }
      );
    }
  }

  /**
   * Track blockchain transaction time
   */
  trackTransaction(
    operation: string,
    contractAddress: string,
    duration: number,
    success: boolean
  ): void {
    logger.info(
      LogCategory.BLOCKCHAIN,
      `Transaction: ${operation}`,
      {
        contractAddress,
        operation,
        duration,
        metadata: { success },
      }
    );
  }

  /**
   * Track memory usage (if available)
   */
  trackMemoryUsage(): void {
    if (typeof window === 'undefined') return;
    
    const memory = (performance as any).memory;
    if (memory) {
      this.trackMetric({
        name: 'Memory Usage',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: Date.now(),
        metadata: {
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        },
      });
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function to wrap async operations with performance tracking
 */
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const endTimer = performanceMonitor.startTimer(operationName);
    try {
      const result = await fn(...args);
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  }) as T;
}

/**
 * React hook for tracking component render performance
 */
export function usePerformanceTracking(componentName: string) {
  if (typeof window === 'undefined') return;

  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    logger.trackPerformance(`Component render: ${componentName}`, duration);
  };
}
