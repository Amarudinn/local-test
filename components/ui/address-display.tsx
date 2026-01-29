'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AddressDisplayProps {
  address: string;
  showCopy?: boolean;
  className?: string;
}

/**
 * AddressDisplay component formats and displays blockchain addresses
 * Supports GenLayer's 64-character hex addresses
 * 
 * Features:
 * - Formats addresses to show first 6 and last 4 characters (0x1234...5678)
 * - Optional copy to clipboard functionality
 * - Visual feedback on successful copy
 * 
 * @param address - The blockchain address to display (supports 64-char GenLayer addresses)
 * @param showCopy - Whether to show the copy button (default: true)
 * @param className - Additional CSS classes for the container
 */
export function AddressDisplay({ 
  address, 
  showCopy = true,
  className 
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  // Format address: show first 6 and last 4 characters
  const formatAddress = (addr: string): string => {
    if (!addr) return '';
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <code className="text-xs md:text-sm font-mono px-1.5 md:px-2 py-0.5 md:py-1 rounded break-all">
        {formatAddress(address)}
      </code>
      
      {showCopy && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 md:h-6 md:w-6 p-0 flex-shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="h-2.5 w-2.5 md:h-3 md:w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{copied ? 'Copied!' : 'Copy address'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
