'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressDisplay } from '@/components/ui/address-display';
import { StatusBadge } from '@/components/ui/status-badge';
import { CountdownTimer } from '@/components/ui/countdown-timer';
import { Debate } from '@/lib/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DebateCardProps {
  debate: Debate;
}

/**
 * DebateCard component displays a preview of a debate
 * Shows topic, creator, participant count, status, and time remaining
 */
export function DebateCard({ debate }: DebateCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if topic is long (more than 80 characters)
  const isLongTopic = debate.topic.length > 80;

  // Handle card click
  const handleClick = () => {
    router.push(`/debates/${debate.contract_address}`);
  };

  // Handle show more/less toggle - prevent card navigation
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setIsExpanded(!isExpanded);
  };

  // Calculate end time from database
  // Database already calculates end_time = created_at + duration_minutes
  const endTimeValue = new Date(debate.end_time).getTime();
  const isActive = endTimeValue > Date.now();

  // Check if time has expired (client-side check)
  const timeHasExpired = endTimeValue <= Date.now();

  // Compute effective status for display (considers time expiration)
  // If time has expired but database still shows ONGOING, display as ENDED
  const effectiveStatus =
    debate.status === 'ONGOING' && timeHasExpired ? 'ENDED' : debate.status;

  // Check if debate is full (use debate.max_participants if available, default to 10)
  const maxParticipants = debate.max_participants || 10;
  const isFull = maxParticipants > 0 && debate.participant_count >= maxParticipants;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] flex flex-col"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base md:text-lg lg:text-xl break-words ${!isExpanded && isLongTopic ? 'line-clamp-2' : ''}`}>
              {debate.topic}
            </CardTitle>
            {isLongTopic && (
              <button
                onClick={handleToggleExpand}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-1 flex items-center gap-1 transition-colors"
              >
                {isExpanded ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
          <StatusBadge status={effectiveStatus} className="flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        <div className="space-y-2 text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="flex-shrink-0">Contract:</span>
            <AddressDisplay address={debate.contract_address} showCopy={false} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex-shrink-0">Participants:</span>
            <span className="font-semibold">
              {debate.participant_count}/{maxParticipants === 0 ? '∞' : maxParticipants}
              {isFull && <span className="text-red-500 ml-1">(Full)</span>}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex-shrink-0">Time:</span>
            {isActive ? (
              <CountdownTimer
                endTime={Math.floor(endTimeValue / 1000)}
                showIcon={false}
              />
            ) : (
              <span className="text-xs md:text-sm font-medium text-muted-foreground">
                Ended
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
