/**
 * Centralized logging utility for Debate Room platform
 * Handles error logging, performance monitoring, and user activity tracking
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum LogCategory {
  AUTH = 'auth',
  BLOCKCHAIN = 'blockchain',
  DATABASE = 'database',
  UI = 'ui',
  SYNC = 'sync',
  PERFORMANCE = 'performance',
}

interface LogContext {
  userAddress?: string;
  contractAddress?: string;
  operation?: string;
  timestamp?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Log debug information (development only)
   */
  debug(category: LogCategory, message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log({
        level: LogLevel.DEBUG,
        category,
        message,
        context,
      });
    }
  }

  /**
   * Log informational messages
   */
  info(category: LogCategory, message: string, context?: LogContext): void {
    this.log({
      level: LogLevel.INFO,
      category,
      message,
      context,
    });
  }

  /**
   * Log warning messages
   */
  warn(category: LogCategory, message: string, context?: LogContext): void {
    this.log({
      level: LogLevel.WARN,
      category,
      message,
      context,
    });
  }

  /**
   * Log error messages
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    this.log({
      level: LogLevel.ERROR,
      category,
      message,
      context,
      error,
    });
  }

  /**
   * Log critical errors (always sent to monitoring service)
   */
  critical(
    category: LogCategory,
    message: string,
    error: Error,
    context?: LogContext
  ): void {
    this.log({
      level: LogLevel.CRITICAL,
      category,
      message,
      context,
      error,
    });

    // Always send critical errors to monitoring service
    if (this.isProduction) {
      this.sendToMonitoringService({
        level: LogLevel.CRITICAL,
        category,
        message,
        context,
        error,
      });
    }
  }

  /**
   * Core logging function
   */
  private log(entry: LogEntry): void {
    const timestamp = new Date().toISOString();
    const logData = {
      ...entry,
      context: {
        ...entry.context,
        timestamp,
      },
    };

    // Console logging (always in development, errors only in production)
    if (this.isDevelopment || entry.level === LogLevel.ERROR || entry.level === LogLevel.CRITICAL) {
      this.logToConsole(logData);
    }

    // Send to monitoring service in production
    if (this.isProduction && (entry.level === LogLevel.ERROR || entry.level === LogLevel.CRITICAL)) {
      this.sendToMonitoringService(logData);
    }
  }

  /**
   * Log to browser console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] [${entry.category}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.context);
        break;
      case LogLevel.INFO:
        console.info(message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, entry.context, entry.error);
        if (entry.error?.stack) {
          console.error('Stack trace:', entry.error.stack);
        }
        break;
    }
  }

  /**
   * Send logs to external monitoring service
   * Integrate with services like Sentry, LogRocket, or Datadog
   */
  private sendToMonitoringService(entry: LogEntry): void {
    // TODO: Integrate with monitoring service (e.g., Sentry)
    // Example Sentry integration:
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(entry.error || new Error(entry.message), {
    //     level: entry.level,
    //     tags: {
    //       category: entry.category,
    //     },
    //     extra: entry.context,
    //   });
    // }

    // For now, log to console in production
    console.error('[MONITORING]', entry);
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    operation: string,
    duration: number,
    context?: Omit<LogContext, 'duration' | 'operation'>
  ): void {
    this.info(LogCategory.PERFORMANCE, `Performance: ${operation}`, {
      ...context,
      operation,
      duration,
    });

    // Send to analytics service if duration exceeds threshold
    if (duration > 3000) {
      this.warn(LogCategory.PERFORMANCE, `Slow operation: ${operation}`, {
        ...context,
        operation,
        duration,
      });
    }
  }

  /**
   * Track user activity
   */
  trackActivity(
    action: string,
    userAddress?: string,
    metadata?: Record<string, any>
  ): void {
    this.info(LogCategory.UI, `User activity: ${action}`, {
      userAddress,
      metadata,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience functions for common logging scenarios
export const logAuth = {
  login: (userAddress: string, method: string) =>
    logger.info(LogCategory.AUTH, 'User logged in', {
      userAddress,
      metadata: { method },
    }),
  logout: (userAddress: string) =>
    logger.info(LogCategory.AUTH, 'User logged out', { userAddress }),
  error: (message: string, error: Error) =>
    logger.error(LogCategory.AUTH, message, error),
};

export const logBlockchain = {
  deploy: (contractAddress: string, userAddress: string) =>
    logger.info(LogCategory.BLOCKCHAIN, 'Contract deployed', {
      contractAddress,
      userAddress,
    }),
  transaction: (
    operation: string,
    contractAddress: string,
    userAddress: string,
    txHash?: string
  ) =>
    logger.info(LogCategory.BLOCKCHAIN, `Transaction: ${operation}`, {
      contractAddress,
      userAddress,
      metadata: { txHash },
    }),
  error: (message: string, error: Error, contractAddress?: string) =>
    logger.error(LogCategory.BLOCKCHAIN, message, error, { contractAddress }),
};

export const logDatabase = {
  query: (operation: string, table: string, duration?: number) =>
    logger.debug(LogCategory.DATABASE, `Database query: ${operation}`, {
      operation,
      duration,
      metadata: { table },
    }),
  sync: (operation: string, contractAddress: string) =>
    logger.info(LogCategory.DATABASE, `Sync: ${operation}`, {
      contractAddress,
      operation,
    }),
  error: (message: string, error: Error, operation?: string) =>
    logger.error(LogCategory.DATABASE, message, error, { operation }),
};

export const logSync = {
  start: (operation: string, contractAddress: string) =>
    logger.info(LogCategory.SYNC, `Sync started: ${operation}`, {
      contractAddress,
      operation,
    }),
  complete: (operation: string, contractAddress: string, duration: number) =>
    logger.info(LogCategory.SYNC, `Sync completed: ${operation}`, {
      contractAddress,
      operation,
      duration,
    }),
  error: (message: string, error: Error, contractAddress: string, operation: string) =>
    logger.critical(LogCategory.SYNC, message, error, {
      contractAddress,
      operation,
    }),
};
