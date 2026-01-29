'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DebateStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: DebateStatus;
  className?: string;
}

/**
 * StatusBadge component displays color-coded status indicators for debates
 * 
 * Color coding:
 * - OPEN: Green (bg-green-500) - Debate is accepting participants
 * - ONGOING: Blue (bg-blue-500) - Debate has started and is in progress
 * - ENDED: Yellow (bg-yellow-500) - Debate time has expired, awaiting resolution
 * - RESOLVED: Purple (bg-purple-500) - Debate has been judged and results are available
 * 
 * @param status - The current debate status
 * @param className - Additional CSS classes for the badge
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Map status to colors and labels
  const statusConfig: Record<DebateStatus, { color: string; label: string }> = {
    OPEN: { 
      color: 'bg-green-500 hover:bg-green-600 text-white', 
      label: 'Open' 
    },
    ONGOING: { 
      color: 'bg-blue-500 hover:bg-blue-600 text-white', 
      label: 'Ongoing' 
    },
    ENDED: { 
      color: 'bg-yellow-500 hover:bg-yellow-600 text-white', 
      label: 'Ended' 
    },
    RESOLVED: { 
      color: 'bg-purple-500 hover:bg-purple-600 text-white', 
      label: 'Resolved' 
    },
  };

  const config = statusConfig[status];

  return (
    <Badge 
      className={cn(config.color, 'text-xs md:text-sm px-2 py-0.5', className)}
    >
      {config.label}
    </Badge>
  );
}
