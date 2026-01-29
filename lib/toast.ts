/**
 * Toast notification utilities
 * Wrapper around sonner for consistent toast notifications
 */

import { toast as sonnerToast } from 'sonner';
import { ErrorInfo, ErrorType } from './error-handler';

/**
 * Toast configuration
 */
const TOAST_CONFIG = {
  duration: 5000, // 5 seconds
  position: 'bottom-right' as const,
};

/**
 * Show success toast
 */
export function showSuccess(message: string, description?: string) {
  sonnerToast.success(message, {
    description,
    duration: TOAST_CONFIG.duration,
  });
}

/**
 * Show error toast
 */
export function showError(message: string, description?: string) {
  sonnerToast.error(message, {
    description,
    duration: TOAST_CONFIG.duration,
  });
}

/**
 * Show warning toast
 */
export function showWarning(message: string, description?: string) {
  sonnerToast.warning(message, {
    description,
    duration: TOAST_CONFIG.duration,
  });
}

/**
 * Show info toast
 */
export function showInfo(message: string, description?: string) {
  sonnerToast.info(message, {
    description,
    duration: TOAST_CONFIG.duration,
  });
}

/**
 * Show loading toast (returns toast ID for dismissal)
 */
export function showLoading(message: string, description?: string) {
  return sonnerToast.loading(message, {
    description,
  });
}

/**
 * Dismiss a specific toast by ID
 */
export function dismissToast(toastId: string | number) {
  sonnerToast.dismiss(toastId);
}

/**
 * Show error toast from ErrorInfo
 */
export function showErrorFromInfo(errorInfo: ErrorInfo) {
  const icon = getErrorIcon(errorInfo.type);
  
  sonnerToast.error(errorInfo.message, {
    description: errorInfo.context?.description,
    duration: TOAST_CONFIG.duration,
    icon,
  });
}

/**
 * Get appropriate icon for error type
 */
function getErrorIcon(errorType: ErrorType): string {
  switch (errorType) {
    case ErrorType.VALIDATION:
      return '⚠️';
    case ErrorType.BLOCKCHAIN:
      return '⛓️';
    case ErrorType.DATABASE:
      return '💾';
    case ErrorType.NETWORK:
      return '🌐';
    case ErrorType.AUTHENTICATION:
      return '🔐';
    default:
      return '❌';
  }
}

/**
 * Show promise toast (automatically updates based on promise state)
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    duration: TOAST_CONFIG.duration,
  });
}

/**
 * Toast utilities for common operations
 */
export const toast = {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  dismiss: dismissToast,
  promise: showPromise,
  fromError: showErrorFromInfo,
};
