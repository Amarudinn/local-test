/**
 * Centralized error handling utilities
 * Provides error classification, user-friendly messages, and retry logic
 */

import { logger, LogCategory } from './logger';

/**
 * Error types for classification
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  BLOCKCHAIN = 'BLOCKCHAIN',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  retryable: boolean;
  context?: Record<string, any>;
}

/**
 * Classify an error based on its message and type
 */
export function classifyError(error: unknown): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();

  // Validation errors
  if (
    errorLower.includes('must be') ||
    errorLower.includes('required') ||
    errorLower.includes('invalid') ||
    errorLower.includes('characters or less') ||
    errorLower.includes('cannot be empty')
  ) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.WARNING,
      message: errorMessage,
      originalError: error instanceof Error ? error : undefined,
      retryable: false,
    };
  }

  // Authentication errors
  if (
    errorLower.includes('authentication') ||
    errorLower.includes('not logged in') ||
    errorLower.includes('session expired') ||
    errorLower.includes('unauthorized')
  ) {
    return {
      type: ErrorType.AUTHENTICATION,
      severity: ErrorSeverity.WARNING,
      message: getUserFriendlyMessage(errorMessage, ErrorType.AUTHENTICATION),
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
    };
  }

  // Blockchain transaction errors
  if (
    errorLower.includes('transaction') ||
    errorLower.includes('contract') ||
    errorLower.includes('deploy') ||
    errorLower.includes('insufficient funds') ||
    errorLower.includes('gas') ||
    errorLower.includes('cancelled') ||
    errorLower.includes('rejected') ||
    errorLower.includes('already submitted') ||
    errorLower.includes('already joined') ||
    errorLower.includes('ended') ||
    errorLower.includes('resolved')
  ) {
    return {
      type: ErrorType.BLOCKCHAIN,
      severity: ErrorSeverity.ERROR,
      message: getUserFriendlyMessage(errorMessage, ErrorType.BLOCKCHAIN),
      originalError: error instanceof Error ? error : undefined,
      retryable: !errorLower.includes('cancelled') && !errorLower.includes('rejected'),
    };
  }

  // Database errors
  if (
    errorLower.includes('database') ||
    errorLower.includes('supabase') ||
    errorLower.includes('query') ||
    errorLower.includes('fetch') ||
    errorLower.includes('sync')
  ) {
    return {
      type: ErrorType.DATABASE,
      severity: ErrorSeverity.ERROR,
      message: getUserFriendlyMessage(errorMessage, ErrorType.DATABASE),
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
    };
  }

  // Network errors
  if (
    errorLower.includes('network') ||
    errorLower.includes('timeout') ||
    errorLower.includes('connection') ||
    errorLower.includes('fetch failed') ||
    errorLower.includes('econnrefused')
  ) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.ERROR,
      message: getUserFriendlyMessage(errorMessage, ErrorType.NETWORK),
      originalError: error instanceof Error ? error : undefined,
      retryable: true,
    };
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    message: 'An unexpected error occurred. Please try again.',
    originalError: error instanceof Error ? error : undefined,
    retryable: true,
  };
}

/**
 * Get user-friendly error message based on error type and original message
 */
function getUserFriendlyMessage(originalMessage: string, type: ErrorType): string {
  const messageLower = originalMessage.toLowerCase();

  // Blockchain-specific messages
  if (type === ErrorType.BLOCKCHAIN) {
    if (messageLower.includes('insufficient funds') || messageLower.includes('gas')) {
      return 'Insufficient funds for transaction';
    }
    if (messageLower.includes('cancelled') || messageLower.includes('rejected')) {
      return 'Transaction was cancelled';
    }
    if (messageLower.includes('timeout')) {
      return 'Transaction is taking longer than expected';
    }
    if (messageLower.includes('already submitted') || messageLower.includes('already joined')) {
      return 'You have already submitted an argument to this debate';
    }
    if (messageLower.includes('ended')) {
      return 'This debate has ended and is no longer accepting arguments';
    }
    if (messageLower.includes('resolved')) {
      return 'This debate has already been resolved';
    }
    if (messageLower.includes('not ended yet')) {
      return 'This debate has not ended yet. Please wait until the end time';
    }
    return 'Failed to connect to blockchain. Please try again';
  }

  // Database-specific messages
  if (type === ErrorType.DATABASE) {
    if (messageLower.includes('timeout')) {
      return 'Request timed out. Please try again';
    }
    if (messageLower.includes('sync')) {
      return 'Data synchronization failed. Some information may be outdated';
    }
    return 'Unable to load data. Please refresh the page';
  }

  // Network-specific messages
  if (type === ErrorType.NETWORK) {
    if (messageLower.includes('timeout')) {
      return 'Request timed out. Please check your connection';
    }
    return 'Network error. Please check your connection and try again';
  }

  // Authentication-specific messages
  if (type === ErrorType.AUTHENTICATION) {
    if (messageLower.includes('session expired')) {
      return 'Your session has expired. Please log in again';
    }
    if (messageLower.includes('wallet')) {
      return 'Failed to connect wallet. Please try again';
    }
    return 'Authentication failed. Please try again';
  }

  // Return original message if no specific mapping found
  return originalMessage;
}

/**
 * Handle an error with logging and optional retry
 */
export function handleError(
  error: unknown,
  context?: Record<string, any>
): ErrorInfo {
  const errorInfo = classifyError(error);
  errorInfo.context = context;

  // Log the error
  const logCategory = getLogCategory(errorInfo.type);
  const logError = errorInfo.originalError || new Error(errorInfo.message);

  switch (errorInfo.severity) {
    case ErrorSeverity.CRITICAL:
      logger.critical(logCategory, errorInfo.message, logError, { metadata: context });
      break;
    case ErrorSeverity.ERROR:
      logger.error(logCategory, errorInfo.message, logError, { metadata: context });
      break;
    case ErrorSeverity.WARNING:
      logger.warn(logCategory, errorInfo.message, { metadata: context });
      break;
    case ErrorSeverity.INFO:
      logger.info(logCategory, errorInfo.message, { metadata: context });
      break;
  }

  return errorInfo;
}

/**
 * Get appropriate log category for error type
 */
function getLogCategory(errorType: ErrorType): LogCategory {
  switch (errorType) {
    case ErrorType.BLOCKCHAIN:
      return LogCategory.BLOCKCHAIN;
    case ErrorType.DATABASE:
      return LogCategory.DATABASE;
    case ErrorType.AUTHENTICATION:
      return LogCategory.AUTH;
    case ErrorType.NETWORK:
      return LogCategory.API;
    default:
      return LogCategory.UI;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
}

/**
 * Default retry configurations by error type
 */
export const DEFAULT_RETRY_CONFIG: Record<ErrorType, RetryConfig> = {
  [ErrorType.NETWORK]: {
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
  },
  [ErrorType.DATABASE]: {
    maxAttempts: 2,
    delayMs: 1000,
    exponentialBackoff: false,
  },
  [ErrorType.BLOCKCHAIN]: {
    maxAttempts: 1,
    delayMs: 0,
    exponentialBackoff: false,
  },
  [ErrorType.AUTHENTICATION]: {
    maxAttempts: 1,
    delayMs: 0,
    exponentialBackoff: false,
  },
  [ErrorType.VALIDATION]: {
    maxAttempts: 0,
    delayMs: 0,
    exponentialBackoff: false,
  },
  [ErrorType.UNKNOWN]: {
    maxAttempts: 1,
    delayMs: 1000,
    exponentialBackoff: false,
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff if enabled
      const delay = config.exponentialBackoff
        ? config.delayMs * Math.pow(2, attempt)
        : config.delayMs;

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable based on its classification
 */
export function isRetryable(error: unknown): boolean {
  const errorInfo = classifyError(error);
  return errorInfo.retryable;
}

/**
 * Get retry configuration for an error
 */
export function getRetryConfig(error: unknown): RetryConfig {
  const errorInfo = classifyError(error);
  return DEFAULT_RETRY_CONFIG[errorInfo.type];
}
