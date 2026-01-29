'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  endTime: number; // Unix timestamp in seconds
  className?: string;
  showIcon?: boolean;
}

/**
 * CountdownTimer component displays a real-time countdown to a debate's end time
 * 
 * Features:
 * - Updates every second for real-time countdown
 * - Displays format: "Xd Xh Xm" or "Xh Xm" or "Xm" depending on time remaining
 * - Shows "Ended" when time expires
 * - Automatically cleans up interval on unmount
 * 
 * @param endTime - Unix timestamp in seconds when the debate ends
 * @param className - Additional CSS classes for the container
 * @param showIcon - Whether to show the clock icon (default: true)
 */
export function CountdownTimer({ 
  endTime, 
  className,
  showIcon = true 
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    // Calculate time remaining
    const calculateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const diff = endTime - now;

      if (diff <= 0) {
        return 'Ended';
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      // Format based on time remaining
      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    };

    // Set initial value
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [endTime]);

  const isEnded = timeRemaining === 'Ended';

  return (
    <div className={cn('inline-flex items-center gap-1 md:gap-1.5', className)}>
      {showIcon && (
        <Clock className={cn(
          'h-3 w-3 md:h-4 md:w-4 flex-shrink-0',
          isEnded ? 'text-red-500' : 'text-muted-foreground'
        )} />
      )}
      <span className={cn(
        'text-xs md:text-sm font-medium whitespace-nowrap',
        isEnded ? 'text-red-500' : 'text-foreground'
      )}>
        {timeRemaining}
      </span>
    </div>
  );
}
