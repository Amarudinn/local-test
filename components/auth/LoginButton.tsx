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
