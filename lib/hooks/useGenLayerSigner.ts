'use client';

import { useEffect, useState, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { logger, LogCategory } from '../logger';
import type { EIP1193Provider } from 'viem';

// Store client globally to avoid recreating
let globalClient: any = null;

/**
 * Hook to automatically setup GenLayer client with Privy wallet using EIP-1193 Provider
 * 
 * Uses Privy's EIP-1193 provider interface for secure transaction signing.
 * This method does NOT export private keys - instead uses the standard Web3 provider pattern.
 * 
 * Benefits:
 * - More secure: Private key never exposed to JavaScript
 * - Transparent: User sees confirmation popup for each transaction
 * - Standard: Uses EIP-1193 provider interface (Web3 standard)
 * 
 * Priority:
 * 1. Privy embedded wallet (walletClientType === 'privy') - Created for email/social login
 * 2. First available wallet - Fallback if no embedded wallet found
 * 
 * Must be called in a component that's wrapped by PrivyProvider
 */
export function useGenLayerSigner() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [isSignerAttached, setIsSignerAttached] = useState(false);
  const hasAttachedRef = useRef(false);

  useEffect(() => {
    // Wait for Privy to be ready and user to be authenticated
    if (!ready || !authenticated || !user) {
      logger.debug(LogCategory.BLOCKCHAIN, 'Waiting for Privy authentication', {
        metadata: {
          ready,
          authenticated,
          hasUser: !!user
        }
      });
      setIsSignerAttached(false);
      globalClient = null;
      hasAttachedRef.current = false;
      return;
    }

    // Wait for wallets to be available
    if (wallets.length === 0) {
      logger.debug(LogCategory.BLOCKCHAIN, 'Waiting for Privy wallet to be created');
      setIsSignerAttached(false);
      globalClient = null;
      hasAttachedRef.current = false;
      return;
    }

    // Only attach signer once per session
    if (hasAttachedRef.current && globalClient) {
      return;
    }

    // Attach signer when user is authenticated and has a wallet
    const attachSignerAsync = async () => {
      try {
        // Find Privy's embedded wallet (not external wallet like MetaMask)
        // Privy embedded wallets have walletClientType === 'privy'
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        const primaryWallet = embeddedWallet || wallets[0]; // Fallback to first wallet if no embedded wallet

        logger.info(LogCategory.BLOCKCHAIN, 'Setting up GenLayer client with Privy wallet (EIP-1193 Provider)', {
          metadata: {
            walletAddress: primaryWallet.address,
            walletType: primaryWallet.walletClientType,
            privyUserId: user.id,
            isEmbeddedWallet: primaryWallet.walletClientType === 'privy',
            hasGetEthereumProvider: typeof primaryWallet.getEthereumProvider === 'function'
          }
        });

        // Check if getEthereumProvider method exists
        if (typeof primaryWallet.getEthereumProvider !== 'function') {
          throw new Error(
            `Wallet type '${primaryWallet.walletClientType}' does not support getEthereumProvider(). ` +
            `Only Privy embedded wallets support this feature. ` +
            `Please ensure you're using a Privy embedded wallet, not an external wallet.`
          );
        }

        // Get EIP-1193 provider from Privy embedded wallet
        // This is the standard Web3 provider interface - NO private key export needed!
        const provider = await primaryWallet.getEthereumProvider();

        if (!provider) {
          throw new Error('Failed to get Ethereum provider from Privy wallet');
        }

        logger.info(LogCategory.BLOCKCHAIN, 'Successfully obtained EIP-1193 provider from Privy wallet');

        // IMPORTANT: Use primaryWallet.address to ensure consistent address
        // The provider might use a different address internally, but we want
        // to use the Privy wallet's address for consistency across sessions
        const walletAddress = primaryWallet.address as `0x${string}`;

        // Create GenLayer client with the provider and account address
        const endpoint = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';

        globalClient = createClient({
          chain: studionet,
          endpoint,
          provider: provider as EIP1193Provider, // Use EIP-1193 provider
          account: walletAddress, // Use Privy wallet address for consistency
        });

        logger.info(LogCategory.BLOCKCHAIN, 'Successfully created GenLayer client with EIP-1193 provider', {
          metadata: {
            walletAddress: walletAddress,
            method: 'EIP-1193 Provider (no private key export)',
            note: 'Using Privy wallet address for consistency',
          }
        });

        setIsSignerAttached(true);
        hasAttachedRef.current = true;
      } catch (error) {
        logger.error(
          LogCategory.BLOCKCHAIN,
          'Failed to setup GenLayer client with Privy wallet',
          error instanceof Error ? error : new Error(String(error))
        );
        setIsSignerAttached(false);
        globalClient = null;
        hasAttachedRef.current = false;
      }
    };

    attachSignerAsync();
  }, [ready, authenticated, user, wallets]);

  return {
    ready: ready && authenticated && isSignerAttached,
    walletAddress: wallets.length > 0 ? wallets[0].address : null,
    client: globalClient,
  };
}
