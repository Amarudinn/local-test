'use client';

import { useGenLayerSigner } from '@/lib/hooks/useGenLayerSigner';

/**
 * GenLayerSignerHandler Component
 * 
 * Automatically attaches Privy wallet as signer to GenLayer client
 * when user is authenticated. This enables contract deployment and
 * write operations on GenLayer blockchain.
 * 
 * Must be rendered inside PrivyProvider context.
 */
export function GenLayerSignerHandler() {
  // This hook automatically attaches the signer when ready
  useGenLayerSigner();
  
  // This component doesn't render anything
  return null;
}
