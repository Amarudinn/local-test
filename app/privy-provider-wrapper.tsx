'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode, useEffect, useState } from 'react';
import { logger, LogCategory } from '@/lib/logger';

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

export function PrivyProviderWrapper({ children }: PrivyProviderWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  if (!privyAppId) {
    logger.warn(LogCategory.AUTH, 'Privy App ID not configured. Authentication features will not work.');
    console.warn('Privy App ID not configured. Authentication features will not work.');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#3b82f6',
          logo: '/logo.png',
        },
        loginMethods: ['email', 'wallet', 'google', 'twitter'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
          priceDisplay: {
            primary: 'native-token',
            secondary: 'fiat-currency',
          },
        },
        supportedChains: [
          {
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
        ],
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
