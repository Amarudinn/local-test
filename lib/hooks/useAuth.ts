/**
 * useAuth Hook
 * 
 * Wraps Privy authentication hooks to provide a unified interface
 * for authentication state and actions throughout the application.
 * 
 * Features:
 * - Access to authenticated user data
 * - Login/logout actions
 * - Wallet connection state
 * - Loading and ready states
 */

'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { logger, LogCategory } from '@/lib/logger';

export interface AuthUser {
  id: string;
  email?: string;
  walletAddress?: string;
  hasWallet: boolean;
  isEmbeddedWallet: boolean;
}

export interface UseAuthReturn {
  // User state
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  
  // Actions
  login: () => void;
  logout: () => Promise<void>;
  
  // Wallet state
  wallets: any[];
  primaryWallet: any | null;
  connectWallet: () => void;
  
  // Raw Privy user for advanced use cases
  privyUser: any;
}

/**
 * Custom hook for authentication
 * 
 * Provides a simplified interface to Privy authentication
 * with automatic user data transformation and logging.
 */
export function useAuth(): UseAuthReturn {
  const {
    ready,
    authenticated,
    user: privyUser,
    login,
    logout: privyLogout,
  } = usePrivy();

  const { wallets } = useWallets();

  // Get primary wallet (first wallet or embedded wallet)
  const primaryWallet = wallets.length > 0 ? wallets[0] : null;

  // Transform Privy user to our AuthUser format
  const user: AuthUser | null = privyUser
    ? {
        id: privyUser.id,
        email: privyUser.email?.address,
        walletAddress: primaryWallet?.address,
        hasWallet: wallets.length > 0,
        isEmbeddedWallet: primaryWallet?.walletClientType === 'privy',
      }
    : null;

  // Log authentication state changes
  useEffect(() => {
    if (ready && authenticated && user) {
      logger.info(LogCategory.AUTH, 'User authenticated', {
        metadata: {
          userId: user.id,
          hasWallet: user.hasWallet,
          isEmbeddedWallet: user.isEmbeddedWallet,
        },
      });
    }
  }, [ready, authenticated, user]);

  // Wrap logout to add logging
  const logout = async () => {
    try {
      logger.info(LogCategory.AUTH, 'User logging out');
      await privyLogout();
      logger.info(LogCategory.AUTH, 'User logged out successfully');
    } catch (error) {
      logger.error(
        LogCategory.AUTH,
        'Logout failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  };

  // Wrap login to add logging
  const handleLogin = () => {
    logger.info(LogCategory.AUTH, 'Login initiated');
    login();
  };

  // Connect wallet action (opens Privy wallet connection modal)
  const connectWallet = () => {
    logger.info(LogCategory.AUTH, 'Wallet connection initiated');
    login();
  };

  return {
    user,
    isAuthenticated: authenticated,
    isLoading: !ready,
    isReady: ready,
    login: handleLogin,
    logout,
    wallets,
    primaryWallet,
    connectWallet,
    privyUser,
  };
}
