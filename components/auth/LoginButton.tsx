/**
 * LoginButton Component
 * 
 * Displays a login button that triggers the Privy authentication modal.
 * Shows different states based on authentication status.
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn, Wallet } from 'lucide-react';

interface LoginButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function LoginButton({
  variant = 'default',
  size = 'default',
  showIcon = true,
  className,
}: LoginButtonProps) {
  const { isAuthenticated, isLoading, login } = useAuth();

  // Don't show login button if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <Button
      onClick={login}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {showIcon && <LogIn className="mr-2 h-4 w-4" />}
      {isLoading ? 'Loading...' : 'Login'}
    </Button>
  );
}

/**
 * ConnectWalletButton Component
 * 
 * Specialized button for wallet connection.
 * Can be used when user is already authenticated but wants to connect a wallet.
 */
export function ConnectWalletButton({
  variant = 'outline',
  size = 'default',
  showIcon = true,
  className,
}: LoginButtonProps) {
  const { isLoading, connectWallet } = useAuth();

  return (
    <Button
      onClick={connectWallet}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {showIcon && <Wallet className="mr-2 h-4 w-4" />}
      {isLoading ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
