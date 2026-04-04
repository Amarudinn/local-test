'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { syncUserOnAuth } from '@/lib/auth-sync';
import { logger, LogCategory } from '@/lib/logger';

export function AuthSyncHandler() {
  const { user, isAuthenticated, isReady, primaryWallet, privyUser } = useAuth();

  useEffect(() => {
    if (!isReady || !isAuthenticated || !privyUser) {
      return;
    }

    const syncUser = async () => {
      try {
        logger.info(LogCategory.AUTH, 'Authentication detected, syncing user');

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

  return null;
}
