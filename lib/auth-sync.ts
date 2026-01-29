/**
 * Authentication Synchronization Service
 * 
 * Handles synchronization between Privy authentication and Supabase database.
 * Creates or updates user records when users authenticate.
 * 
 * Note: Wallet signer attachment is now handled by useGenLayerSigner hook
 * using EIP-1193 Provider method (no private key export needed).
 */

import { supabaseApi, User, isConfigured as isSupabaseConfigured } from './supabase-client';
import { logger, LogCategory } from './logger';

export interface PrivyUserData {
  id: string;
  email?: string;
  walletAddress?: string;
}

/**
 * Sync user data to Supabase on authentication
 * 
 * This function:
 * 1. Checks if user exists in Supabase by Privy ID
 * 2. Creates new user if doesn't exist
 * 3. Updates existing user if wallet address changed
 * 4. Returns the synced user record
 * 
 * @param privyUser - Privy user data
 * @returns Synced user record from Supabase
 */
export async function syncUserOnAuth(privyUser: PrivyUserData): Promise<User | null> {
  // Check if Supabase is configured
  if (!isSupabaseConfigured) {
    logger.warn(LogCategory.AUTH, 'Supabase not configured, skipping user sync', {
      metadata: {
        privyUserId: privyUser.id,
      },
    });
    return null;
  }

  try {
    logger.info(LogCategory.AUTH, 'Syncing user on authentication', {
      metadata: {
        privyUserId: privyUser.id,
        hasEmail: !!privyUser.email,
        hasWallet: !!privyUser.walletAddress,
      },
    });

    // Check if user already exists
    const existingUser = await supabaseApi.getUserByPrivyId(privyUser.id);

    if (existingUser) {
      // User exists - check if we need to update wallet address
      if (privyUser.walletAddress && existingUser.wallet_address !== privyUser.walletAddress) {
        logger.info(LogCategory.AUTH, 'Updating user wallet address', {
          metadata: {
            userId: existingUser.id,
            oldAddress: existingUser.wallet_address,
            newAddress: privyUser.walletAddress,
          },
        });

        const updatedUser = await supabaseApi.updateUser(existingUser.id, {
          wallet_address: privyUser.walletAddress,
        });

        return updatedUser;
      }

      logger.info(LogCategory.AUTH, 'User already synced', {
        metadata: {
          userId: existingUser.id,
        },
      });

      return existingUser;
    }

    // User doesn't exist - create new record
    logger.info(LogCategory.AUTH, 'Creating new user record', {
      metadata: {
        privyUserId: privyUser.id,
      },
    });

    const newUser = await supabaseApi.createUser({
      privy_user_id: privyUser.id,
      wallet_address: privyUser.walletAddress || null,
      email: privyUser.email || null,
    });

    logger.info(LogCategory.AUTH, 'User created successfully', {
      metadata: {
        userId: newUser.id,
      },
    });

    return newUser;
  } catch (error) {
    logger.error(
      LogCategory.AUTH,
      'Failed to sync user',
      error instanceof Error ? error : new Error(String(error)),
      {
        metadata: {
          privyUserId: privyUser.id,
        },
      }
    );
    // Don't throw - authentication should still work even if sync fails
    return null;
  }
}

/**
 * Attach wallet signer to GenLayer client
 * 
 * DEPRECATED: This function is no longer needed with EIP-1193 Provider method.
 * Wallet signer is now automatically attached by useGenLayerSigner hook.
 * 
 * Kept for backward compatibility but does nothing.
 * 
 * @param wallet - Privy wallet object (unused)
 * @deprecated Use useGenLayerSigner hook instead
 */
export async function attachWalletToGenLayer(wallet: any): Promise<void> {
  logger.info(LogCategory.BLOCKCHAIN, 'attachWalletToGenLayer called (deprecated)', {
    metadata: {
      walletAddress: wallet?.address,
      note: 'Wallet signer is now handled by useGenLayerSigner hook',
    },
  });
  
  // No-op: Wallet attachment is now handled by useGenLayerSigner hook
  // which uses EIP-1193 Provider method (more secure, no private key export)
}

/**
 * Handle user logout
 * 
 * DEPRECATED: Logout handling is now managed by Privy and useGenLayerSigner hook.
 * 
 * Kept for backward compatibility but does nothing.
 * 
 * @deprecated Logout is handled automatically by Privy
 */
export function handleLogout(): void {
  logger.info(LogCategory.AUTH, 'handleLogout called (deprecated)', {
    metadata: {
      note: 'Logout is now handled automatically by Privy and useGenLayerSigner hook',
    },
  });
  
  // No-op: Logout is now handled automatically by Privy
  // useGenLayerSigner hook will reset client when user logs out
}
