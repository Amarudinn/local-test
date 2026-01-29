/**
 * AuthSyncHandler Component
 * 
 * Listens to Privy authentication events and synchronizes user data
 * with Supabase database.
 * 
 * Note: Wallet signer attachment is now handled automatically by useGenLayerSigner hook
 * using EIP-1193 Provider method (more secure, no private key export).
 * 
 * This component should be included in the app providers to ensure
 * user sync happens automatically on authentication.
 */

'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { syncUserOnAuth } from '@/lib/auth-sync';
import { logger, LogCategory } from '@/lib/logger';

export function AuthSyncHandler() {
  const { user, isAuthenticated, isReady, primaryWallet, privyUser } = useAuth();

  // Sync user on authentication
  useEffect(() => {
    if (!isReady || !isAuthenticated || !privyUser) {
      return;
    }

    const syncUser = async () => {
      try {
        logger.info(LogCategory.AUTH, 'Authentication detected, syncing user');

        // Sync user to Supabase
        await syncUserOnAuth({
          id: privyUser.id,
          email: privyUser.email?.address,
          walletAddress: primaryWallet?.address,
        });

        logger.info(LogCategory.AUTH, 'User sync completed successfully');
      } catch (error) {
        logger.error(
          LogCategory.AUTH,
          'Failed to sync user on authentication',
          error instanceof Error ? error : new Error(String(error))
        );
        console.error('Failed to sync user:', error);
      }
    };

    syncUser();
  }, [isReady, isAuthenticated, privyUser, primaryWallet]);

  // Note: Wallet attachment to GenLayer client is now handled automatically
  // by useGenLayerSigner hook using EIP-1193 Provider method.
  // No need to manually attach wallet here.

  // Note: Logout handling is now managed automatically by Privy and useGenLayerSigner hook.
  // The hook will reset the client when user logs out.

  // This component doesn't render anything
  return null;
}
