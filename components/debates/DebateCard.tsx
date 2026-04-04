'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddressDisplay } from '@/components/ui/address-display';
import { StatusBadge } from '@/components/ui/status-badge';
import { CountdownTimer } from '@/components/ui/countdown-timer';
import { Debate } from '@/lib/types';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { DebateCover } from './DebateCover';

interface DebateCardProps {
  debate: Debate;
}

export function DebateCard({ debate }: DebateCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const isLongTopic = debate.topic.length > 80;
  const isTweet = debate.source_type === 'tweet';

  const tweetUsername = isTweet && debate.source_url
    ? debate.source_url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/i)?.[1] || null
    : null;

  const handleClick = () => {
    router.push(`/debates/${debate.contract_address}`);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const endTimeValue = new Date(debate.end_time).getTime();
  const isActive = endTimeValue > Date.now();

  const timeHasExpired = endTimeValue <= Date.now();

  const effectiveStatus =
    debate.status === 'ONGOING' && timeHasExpired ? 'ENDED' : debate.status;

  const maxParticipants = debate.max_participants !== undefined && debate.max_participants !== null
    ? debate.max_participants
    : 10;
  const isFull = maxParticipants > 0 && debate.participant_count >= maxParticipants;

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] flex flex-col overflow-hidden"
      onClick={handleClick}
    >
      <DebateCover topic={debate.topic} imageUrl={debate.image_url} className="h-32 w-full flex-shrink-0" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-sm md:text-base break-words whitespace-pre-wrap ${!isExpanded && isLongTopic ? 'line-clamp-2' : ''}`}>
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
          {isTweet && debate.source_url && (
            <div className="flex items-center justify-between gap-2 pb-1 border-b">
              <span className="flex items-center gap-1 font-medium">
                {tweetUsername && <span>@{tweetUsername}</span>}
              </span>
              <a
                href={debate.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                <span>View original tweet</span>
              </a>
            </div>
          )}
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
