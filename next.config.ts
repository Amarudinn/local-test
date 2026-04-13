import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Disable ESLint during production builds (warnings don't block deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript errors during production builds
  typescript: {
    ignoreBuildErrors: true,
  },

  // Allow images from Pinata IPFS gateway
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },

  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_GENLAYER_RPC_URL: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL,
    NEXT_PUBLIC_GENLAYER_CHAIN_ID: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  },

  // Webpack configuration
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default withPWA(nextConfig);
