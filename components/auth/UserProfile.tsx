/**
 * UserProfile Component
 * 
 * Displays authenticated user information and provides logout functionality.
 * Shows wallet address, email, balance, and account type.
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
import { User, Wallet, Mail, Copy, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

/**
 * Format Ethereum address for display
 * Example: 0x1234...5678
 */
function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Fetch GEN balance from GenLayer RPC
 */
async function fetchBalance(address: string): Promise<string> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    if (!response.ok) throw new Error('RPC error');
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // Convert hex wei to GEN (18 decimals)
    const weiHex = data.result;
    const wei = BigInt(weiHex);
    const gen = Number(wei) / 1e18;
    
    // Format to 4 decimal places
    return gen.toFixed(4);
  } catch (error) {
    console.warn('Failed to fetch balance:', error);
    return '—';
  }
}

export function UserProfile() {
  const { user, isAuthenticated, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  // Fetch balance when wallet address is available
  const loadBalance = useCallback(async () => {
    if (user?.walletAddress) {
      const bal = await fetchBalance(user.walletAddress);
      setBalance(bal);
    }
  }, [user?.walletAddress]);

  useEffect(() => {
    loadBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [loadBalance]);

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

        {/* Balance */}
        {user.walletAddress && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.9199 16.7486C21.5899 19.4086 19.4099 21.5886 16.7499 21.9186C15.1399 22.1186 13.6399 21.6786 12.4699 20.8186C11.7999 20.3286 11.9599 19.2886 12.7599 19.0486C15.7699 18.1386 18.1399 15.7586 19.0599 12.7486C19.2999 11.9586 20.3399 11.7986 20.8299 12.4586C21.6799 13.6386 22.1199 15.1386 21.9199 16.7486Z" fill="currentColor"/><path d="M9.99 2C5.58 2 2 5.58 2 9.99C2 14.4 5.58 17.98 9.99 17.98C14.4 17.98 17.98 14.4 17.98 9.99C17.97 5.58 14.4 2 9.99 2ZM9.05 8.87L11.46 9.71C12.33 10.02 12.75 10.63 12.75 11.57C12.75 12.65 11.89 13.54 10.84 13.54H10.75V13.59C10.75 14 10.41 14.34 10 14.34C9.59 14.34 9.25 14 9.25 13.59V13.53C8.14 13.48 7.25 12.55 7.25 11.39C7.25 10.98 7.59 10.64 8 10.64C8.41 10.64 8.75 10.98 8.75 11.39C8.75 11.75 9.01 12.04 9.33 12.04H10.83C11.06 12.04 11.24 11.83 11.24 11.57C11.24 11.22 11.18 11.2 10.95 11.12L8.54 10.28C7.68 9.98 7.25 9.37 7.25 8.42C7.25 7.34 8.11 6.45 9.16 6.45H9.25V6.41C9.25 6 9.59 5.66 10 5.66C10.41 5.66 10.75 6 10.75 6.41V6.47C11.86 6.52 12.75 7.45 12.75 8.61C12.75 9.02 12.41 9.36 12 9.36C11.59 9.36 11.25 9.02 11.25 8.61C11.25 8.25 10.99 7.96 10.67 7.96H9.17C8.94 7.96 8.76 8.17 8.76 8.43C8.75 8.77 8.81 8.79 9.05 8.87Z" fill="currentColor"/></svg>
                <span className="text-xs">Balance</span>
              </div>
              <div className="mt-1 font-semibold text-base">
                {balance === null ? (
                  <span className="text-muted-foreground text-sm">Loading...</span>
                ) : (
                  <>{balance} <span className="text-xs font-medium text-muted-foreground">GEN</span></>
                )}
              </div>
            </div>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        {/* Logout */}
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.00195 7C9.01406 4.82497 9.11051 3.64706 9.87889 2.87868C10.7576 2 12.1718 2 15.0002 2L16.0002 2C18.8286 2 20.2429 2 21.1215 2.87868C22.0002 3.75736 22.0002 5.17157 22.0002 8L22.0002 16C22.0002 18.8284 22.0002 20.2426 21.1215 21.1213C20.2429 22 18.8286 22 16.0002 22H15.0002C12.1718 22 10.7576 22 9.87889 21.1213C9.11051 20.3529 9.01406 19.175 9.00195 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M15 12L2 12M2 12L5.5 9M2 12L5.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

