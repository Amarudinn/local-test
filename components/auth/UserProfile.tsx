/**
 * UserProfile Component
 * 
 * Displays authenticated user information and provides logout functionality.
 * Shows wallet address, email, and account type (embedded vs external wallet).
 */

'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Wallet, Mail, Copy, Check } from 'lucide-react';
import { useState } from 'react';

/**
 * Format Ethereum address for display
 * Example: 0x1234...5678
 */
function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function UserProfile() {
  const { user, isAuthenticated, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Copy address to clipboard
  const copyAddress = async () => {
    if (user.walletAddress) {
      await navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to home page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <User className="h-4 w-4" />
          {user.walletAddress ? formatAddress(user.walletAddress) : user.email || 'Account'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Email */}
        {user.email && (
          <div className="px-2 py-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-xs">Email</span>
            </div>
            <div className="mt-1 font-medium">{user.email}</div>
          </div>
        )}
        
        {/* Wallet Address */}
        {user.walletAddress && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="text-xs">
                  {user.isEmbeddedWallet ? 'Embedded Wallet' : 'Wallet'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-xs">{formatAddress(user.walletAddress)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={copyAddress}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        {/* Logout */}
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple user badge component for inline display
 */
export function UserBadge() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm">
      <User className="h-3 w-3" />
      <span className="font-medium">
        {user.walletAddress ? formatAddress(user.walletAddress) : user.email}
      </span>
    </div>
  );
}
