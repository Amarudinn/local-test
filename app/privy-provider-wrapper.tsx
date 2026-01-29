'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode, useEffect, useState } from 'react';
import { logger, LogCategory } from '@/lib/logger';

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

/**
 * Privy Provider Wrapper
 * 
 * Configures Privy authentication with support for:
 * - Email authentication
 * - Social login (Google, Twitter)
 * - Wallet connections (MetaMask, WalletConnect, etc.)
 * - Embedded wallets for non-crypto users
 * 
 * This enables progressive Web3 onboarding where users can start with
 * email/social and optionally connect wallets later.
 */
export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render Privy provider during SSR
  if (!mounted) {
    return <>{children}</>;
  }

  // If no Privy app ID, render without authentication
  if (!privyAppId) {
    logger.warn(LogCategory.AUTH, 'Privy App ID not configured. Authentication features will not work.');
    console.warn('Privy App ID not configured. Authentication features will not work.');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Appearance customization
        appearance: {
          theme: 'light',
          accentColor: '#3b82f6',
          logo: '/logo.png',
        },
        // Login methods - support email, social, and wallet
        loginMethods: ['email', 'wallet', 'google', 'twitter'],
        // Embedded wallet configuration
        // Auto-generate wallets for users who authenticate via email/social
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
          // IMPORTANT: Enable private key export so we can use the same wallet for GenLayer
          // This ensures the address shown in UI matches the address used for transactions
          priceDisplay: {
            primary: 'native-token',
            secondary: 'fiat-currency',
          },
        },
        // Wallet configuration
        supportedChains: [
          {
            id: 61999, // GenLayer Chain ID
            name: 'GenLayer',
            network: 'genlayer',
            nativeCurrency: {
              name: 'GEN',
              symbol: 'GEN',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api'],
              },
              public: {
                http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api'],
              },
            },
          },
        ],
        // Default chain
        defaultChain: {
          id: 61999,
          name: 'GenLayer',
          network: 'genlayer',
          nativeCurrency: {
            name: 'GEN',
            symbol: 'GEN',
            decimals: 18,
          },
          rpcUrls: {
            default: {
              http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api'],
            },
            public: {
              http: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api'],
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
