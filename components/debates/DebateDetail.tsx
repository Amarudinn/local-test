'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getDebateInfo,
  getParticipants as getBlockchainParticipants,
  getArguments as getBlockchainArguments,
  getResults,
  hasUserJoined,
  joinDebate as joinDebateBlockchain,
  resolveDebate as resolveDebateBlockchain,
  getEvaluationCriteria
} from '@/lib/genlayer-client';
import { supabaseApi } from '@/lib/supabase-client';
import { syncParticipantJoin, syncDebateResolution } from '@/lib/sync-service';
import { useGenLayerSigner } from '@/lib/hooks/useGenLayerSigner';
import { logger, LogCategory } from '@/lib/logger';
import type { DebateStatus } from '@/lib/types';
import { VALIDATION } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock, Users, Calendar, User, AlertCircle, CheckCircle2, Loader2, Trophy, ChevronDown } from 'lucide-react';
import { AddressDisplay } from '@/components/ui/address-display';
import { StatusBadge } from '@/components/ui/status-badge';
import { CountdownTimer } from '@/components/ui/countdown-timer';

interface DebateDetailProps {
  contractAddress: string;
}

interface DebateInfo {
  topic: string;
  description: string;
  creator: string;
  created_at: number;
  duration_seconds: number;
  end_time: number;
  status: DebateStatus;
  participant_count: number;
  max_participants?: number; // Optional for backward compatibility
}

interface ParticipantInfo {
  address: string;
  joined_at: number;
  has_submitted: boolean;
}

interface ArgumentInfo {
  author: string;
  content: string;
  timestamp: number;
}

export function DebateDetail({ contractAddress }: DebateDetailProps) {
  const { authenticated, user } = usePrivy();
  const { ready: signerReady, client, walletAddress } = useGenLayerSigner();
  const userAddress = walletAddress;
  const queryClient = useQueryClient();

  // Form state for argument submission
  const [argument, setArgument] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // State for resolve debate
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('arguments');

  // State for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch debate info from blockchain
  const { data: debateInfo, isLoading: isLoadingDebate, error: debateError } = useQuery<DebateInfo>({
    queryKey: ['debate', contractAddress],
    queryFn: () => getDebateInfo(contractAddress),
    refetchInterval: 30000, // Refetch every 30 seconds to update status
  });

  // Fetch debate from Supabase for faster initial load
  const { data: supabaseDebate, isLoading: isLoadingSupabase } = useQuery({
    queryKey: ['debate-supabase', contractAddress],
    queryFn: () => supabaseApi.getDebateByAddress(contractAddress),
  });

  // Fetch evaluation criteria from blockchain
  const { data: evaluationCriteria } = useQuery({
    queryKey: ['evaluation-criteria', contractAddress],
    queryFn: () => getEvaluationCriteria(contractAddress),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour - criteria rarely changes
  });

  // Fetch participants with hybrid approach (database cache + blockchain fallback)
  const { data: participants, isLoading: isLoadingParticipants } = useQuery<ParticipantInfo[]>({
    queryKey: ['participants', contractAddress],
    queryFn: async () => {
      // Try database first (fast)
      try {
        const dbParticipants = await supabaseApi.getParticipantsByContractAddress(contractAddress);
        if (dbParticipants && dbParticipants.length > 0) {
          console.log('✅ Participants from database (fast):', dbParticipants.length);
          return dbParticipants.map(p => ({
            address: p.participant_address,
            joined_at: p.joined_at,
            has_submitted: p.has_submitted,
          }));
        }
      } catch (error) {
        console.warn('Database fetch failed, falling back to blockchain:', error);
      }

      // Fallback to blockchain (slow but accurate)
      console.log('📡 Fetching participants from blockchain...');
      const blockchainParticipants = await getBlockchainParticipants(contractAddress);
      console.log('✅ Participants from blockchain:', blockchainParticipants.length);

      // Sync to database for next time (non-blocking)
      if (blockchainParticipants.length > 0) {
        import('@/lib/sync-service').then(({ syncParticipantsToDatabase }) => {
          syncParticipantsToDatabase(contractAddress, blockchainParticipants).catch(console.error);
        });
      }

      return blockchainParticipants;
    },
    enabled: !!debateInfo,
  });

  // Fetch arguments with hybrid approach (database cache + blockchain fallback)
  const { data: debateArguments, isLoading: isLoadingArguments } = useQuery<ArgumentInfo[]>({
    queryKey: ['arguments', contractAddress],
    queryFn: async () => {
      // Try database first (fast)
      try {
        const dbArguments = await supabaseApi.getArgumentsByContractAddress(contractAddress);
        if (dbArguments && dbArguments.length > 0) {
          console.log('✅ Arguments from database (fast):', dbArguments.length);
          return dbArguments.map(arg => ({
            author: arg.author_address,
            content: arg.content,
            timestamp: arg.timestamp,
          }));
        }
      } catch (error) {
        console.warn('Database fetch failed, falling back to blockchain:', error);
      }

      // Fallback to blockchain (slow but accurate)
      console.log('📡 Fetching arguments from blockchain...');
      const blockchainArguments = await getBlockchainArguments(contractAddress);
      console.log('✅ Arguments from blockchain:', blockchainArguments.length);

      // Sync to database for next time (non-blocking)
      if (blockchainArguments.length > 0) {
        import('@/lib/sync-service').then(({ syncArgumentsToDatabase }) => {
          syncArgumentsToDatabase(contractAddress, blockchainArguments).catch(console.error);
        });
      }

      return blockchainArguments;
    },
    enabled: !!debateInfo,
  });

  // Fetch results with hybrid approach (database cache + blockchain fallback)
  const { data: results, isLoading: isLoadingResults } = useQuery<{
    winner: string;
    winner_score: number;
    all_scores: Array<{
      address: string;
      score: number;
      reasoning: string;
      breakdown: {
        logic_reasoning: number;
        evidence_facts: number;
        clarity: number;
        relevance: number;
        originality: number;
        persuasiveness: number;
      };
    }>;
  } | null>({
    queryKey: ['results', contractAddress],
    queryFn: async () => {
      // Try database first (fast)
      try {
        const dbResults = await supabaseApi.getLeaderboardByContractAddress(contractAddress);
        if (dbResults) {
          console.log('✅ Leaderboard from database (fast)');
          return dbResults;
        }
      } catch (error) {
        console.warn('Database fetch failed, falling back to blockchain:', error);
      }

      // Fallback to blockchain (slow but accurate)
      console.log('📡 Fetching leaderboard from blockchain...');
      const blockchainResults = await getResults(contractAddress);
      console.log('✅ Leaderboard from blockchain');

      // Sync to database for next time (non-blocking)
      if (blockchainResults && blockchainResults.all_scores.length > 0) {
        import('@/lib/sync-service').then(({ syncLeaderboardToDatabase }) => {
          syncLeaderboardToDatabase(contractAddress, blockchainResults).catch(console.error);
        });
      }

      return blockchainResults;
    },
    // Enable if EITHER blockchain OR database says RESOLVED
    enabled: !!debateInfo && (debateInfo.status === 'RESOLVED' || supabaseDebate?.status === 'RESOLVED'),
  });

  // Check if current user has joined - use both blockchain and database
  const { data: userHasJoinedBlockchain } = useQuery({
    queryKey: ['user-joined-blockchain', contractAddress, userAddress],
    queryFn: () => hasUserJoined(contractAddress, userAddress!),
    enabled: !!userAddress && !!debateInfo,
  });

  // Also check from database (faster and more reliable for recent joins)
  const { data: userHasJoinedDatabase } = useQuery({
    queryKey: ['user-joined-database', contractAddress, userAddress],
    queryFn: async () => {
      if (!supabaseDebate) return false;
      return await supabaseApi.hasUserJoined(supabaseDebate.id, userAddress!);
    },
    enabled: !!userAddress && !!supabaseDebate,
  });

  // User has joined if EITHER blockchain OR database says so
  const userHasJoined = userHasJoinedBlockchain || userHasJoinedDatabase;

  // Mutation for submitting argument
  const submitArgumentMutation = useMutation({
    mutationFn: async (argumentText: string) => {
      if (!userAddress) {
        throw new Error('User address not available');
      }

      if (!client) {
        throw new Error('Wallet client not ready');
      }

      // Call blockchain to join debate
      await joinDebateBlockchain(client, contractAddress, argumentText);

      // Sync to database (non-blocking - don't fail if sync fails)
      try {
        await syncParticipantJoin(contractAddress, userAddress, argumentText);
      } catch (syncError) {
        // Log the error but don't fail the mutation
        console.warn('Failed to sync participant join to database:', syncError);
        logger.warn(LogCategory.SYNC, 'Database sync failed (non-critical)', {
          contractAddress,
          metadata: {
            participantAddress: userAddress,
            error: syncError instanceof Error ? syncError.message : String(syncError)
          }
        });
      }
    },
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      setShowForm(false);

      // Optimistic update: immediately set userHasJoined to true
      queryClient.setQueryData(['user-joined-blockchain', contractAddress, userAddress], true);
      queryClient.setQueryData(['user-joined-database', contractAddress, userAddress], true);

      // Wait a bit for blockchain to update, then refetch
      setTimeout(() => {
        // Refetch debate data to update UI
        queryClient.invalidateQueries({ queryKey: ['debate', contractAddress] });
        queryClient.invalidateQueries({ queryKey: ['participants', contractAddress] });
        queryClient.invalidateQueries({ queryKey: ['arguments', contractAddress] });
        queryClient.invalidateQueries({ queryKey: ['user-joined-blockchain', contractAddress, userAddress] });
        queryClient.invalidateQueries({ queryKey: ['user-joined-database', contractAddress, userAddress] });
        queryClient.invalidateQueries({ queryKey: ['debate-supabase', contractAddress] });
      }, 2000); // Wait 2 seconds for blockchain to update
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
      setSubmitSuccess(false);
    },
  });

  // Mutation for resolving debate
  const resolveDebateMutation = useMutation({
    mutationFn: async () => {
      if (!client) {
        throw new Error('Wallet client not ready');
      }

      // Call blockchain to resolve debate
      await resolveDebateBlockchain(client, contractAddress);

      // Fetch results from blockchain
      const results = await getResults(contractAddress);

      // Sync results to database
      await syncDebateResolution(contractAddress, results);

      return results;
    },
    onSuccess: () => {
      setResolveError(null);

      // Refetch debate data to update UI
      queryClient.invalidateQueries({ queryKey: ['debate', contractAddress] });
      queryClient.invalidateQueries({ queryKey: ['debate-supabase', contractAddress] });
      queryClient.invalidateQueries({ queryKey: ['results', contractAddress] });

      // Switch to leaderboard tab
      setActiveTab('leaderboard');
    },
    onError: (error: Error) => {
      setResolveError(error.message);
    },
  });

  // Handle argument submission
  const handleSubmitArgument = async () => {
    // Reset states
    setSubmitError(null);
    setSubmitSuccess(false);

    // Validate argument
    if (!argument || argument.trim().length === 0) {
      setSubmitError('Argument cannot be empty');
      return;
    }

    if (argument.length > VALIDATION.ARGUMENT_MAX_LENGTH) {
      setSubmitError(`Argument must be ${VALIDATION.ARGUMENT_MAX_LENGTH} characters or less`);
      return;
    }

    // Submit argument
    submitArgumentMutation.mutate(argument);
  };

  // Handle resolve debate
  const handleResolveDebate = async () => {
    setResolveError(null);
    resolveDebateMutation.mutate();
  };

  // Handle manual refresh from blockchain
  const handleRefreshFromBlockchain = async () => {
    setIsRefreshing(true);

    try {
      // Force fetch from blockchain (bypass cache)
      console.log('🔄 Force fetching from blockchain...');

      // Fetch participants from blockchain
      const blockchainParticipants = await getBlockchainParticipants(contractAddress);
      console.log('✅ Fetched participants:', blockchainParticipants.length);

      // Fetch arguments from blockchain
      const blockchainArguments = await getBlockchainArguments(contractAddress);
      console.log('✅ Fetched arguments:', blockchainArguments.length);

      // Sync to database
      if (blockchainParticipants.length > 0) {
        await import('@/lib/sync-service').then(({ syncParticipantsToDatabase }) => {
          return syncParticipantsToDatabase(contractAddress, blockchainParticipants);
        });
        console.log('✅ Synced participants to database');
      }

      if (blockchainArguments.length > 0) {
        await import('@/lib/sync-service').then(({ syncArgumentsToDatabase }) => {
          return syncArgumentsToDatabase(contractAddress, blockchainArguments);
        });
        console.log('✅ Synced arguments to database');
      }

      // Invalidate queries to refetch from database
      queryClient.invalidateQueries({ queryKey: ['participants', contractAddress] });
      queryClient.invalidateQueries({ queryKey: ['arguments', contractAddress] });
      queryClient.invalidateQueries({ queryKey: ['debate', contractAddress] });
      queryClient.invalidateQueries({ queryKey: ['debate-supabase', contractAddress] });

    } catch (error) {
      console.error('❌ Failed to refresh from blockchain:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get user's submitted argument if they've joined
  const userArgument = debateArguments?.find(
    arg => arg.author?.toLowerCase() === userAddress?.toLowerCase()
  );

  // Use hybrid data: prefer blockchain when available, fallback to Supabase
  // For OPEN debates, blockchain timestamps are 0, so we use Supabase timestamps
  const displayData = (() => {
    // Case 1: Both blockchain and database data available (ideal)
    if (debateInfo && supabaseDebate) {
      // CRITICAL FIX: Always use database duration_minutes for display
      // Old contracts on blockchain may have incorrect duration_seconds (using hours instead of minutes)
      // Database is the source of truth for duration since it's set correctly at creation time
      const duration_seconds = supabaseDebate.duration_minutes * 60;

      console.log('🔍 DEBUG displayData Case 1 (Blockchain + Database):', {
        blockchain_duration_seconds: debateInfo.duration_seconds,
        database_duration_minutes: supabaseDebate.duration_minutes,
        calculated_duration_seconds: duration_seconds,
        using_database_value: true,
      });

      return {
        topic: debateInfo.topic,
        description: debateInfo.description,
        // Use Supabase timestamps if blockchain timestamps are 0 (debate still OPEN)
        created_at: debateInfo.created_at > 0
          ? debateInfo.created_at
          : new Date(supabaseDebate.created_at).getTime() / 1000,
        duration_seconds: duration_seconds,  // ALWAYS use calculated value from database
        end_time: debateInfo.end_time > 0
          ? debateInfo.end_time
          : new Date(supabaseDebate.end_time).getTime() / 1000,
        // Prefer database status if it's RESOLVED (cron job updates database, not blockchain)
        status: supabaseDebate.status === 'RESOLVED' ? 'RESOLVED' : debateInfo.status,
        participant_count: debateInfo.participant_count,
        max_participants: debateInfo.max_participants,
      };
    }

    // Case 2: Only Supabase data available (blockchain still loading or failed)
    // This is common for newly created debates
    if (supabaseDebate) {
      console.log('🔍 DEBUG displayData Case 2 (Database only):', {
        database_duration_minutes: supabaseDebate.duration_minutes,
        calculated_duration_seconds: supabaseDebate.duration_minutes * 60,
      });

      return {
        topic: supabaseDebate.topic,
        description: supabaseDebate.description,
        created_at: new Date(supabaseDebate.created_at).getTime() / 1000,
        duration_seconds: supabaseDebate.duration_minutes * 60,
        end_time: new Date(supabaseDebate.end_time).getTime() / 1000,
        status: supabaseDebate.status,
        participant_count: supabaseDebate.participant_count,
        max_participants: 10, // Default for database-only data
      };
    }

    // Case 3: Only blockchain data available (database query failed)
    if (debateInfo) {
      console.log('🔍 DEBUG displayData Case 3 (Blockchain only):', {
        blockchain_duration_seconds: debateInfo.duration_seconds,
      });

      return debateInfo;
    }

    // Case 4: No data available
    return null;
  })();

  // Set initial tab based on debate status
  useEffect(() => {
    if (displayData?.status === 'RESOLVED') {
      setActiveTab('leaderboard');
    }
  }, [displayData?.status]);

  if (debateError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Debate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load debate information. The contract address may be invalid or the network may be unavailable.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Error: {debateError instanceof Error ? debateError.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingDebate && isLoadingSupabase && !displayData) {
    return <DebateDetailSkeleton />;
  }

  if (!displayData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Debate Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No debate found at this address.
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = displayData.status;
  const isOpen = status === 'OPEN' || status === 'ONGOING';
  const isEnded = status === 'ENDED';
  const isResolved = status === 'RESOLVED';

  // Calculate time remaining - only if end_time is set
  const now = Date.now() / 1000;
  const timeRemaining = displayData.end_time > 0 ? displayData.end_time - now : 0;

  // Check if time has expired (client-side check)
  const timeHasExpired = displayData.end_time > 0 && timeRemaining <= 0;

  // hasEnded should check BOTH database status AND time expiration
  // This allows showing "Resolve Debate" button even if database hasn't updated yet
  const hasEnded = isEnded || (status === 'ONGOING' && timeHasExpired);

  // Compute effective status for display (considers time expiration)
  // If time has expired but database still shows ONGOING, display as ENDED
  const effectiveStatus: DebateStatus =
    status === 'ONGOING' && timeHasExpired ? 'ENDED' : status;

  // Check if debate is full - use evaluationCriteria from blockchain (more accurate)
  const maxParticipants = evaluationCriteria?.max_participants || displayData.max_participants || 10;
  const isFull = maxParticipants > 0 && displayData.participant_count >= maxParticipants;

  const showJoinButton = authenticated && signerReady && isOpen && !userHasJoined && !timeHasExpired && !isFull;
  const showResolveButton = signerReady && hasEnded && !isResolved;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Debate Header */}
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-2 flex-1 min-w-0">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl break-words">{displayData.topic}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={effectiveStatus} />
                <Badge variant="outline" className="gap-1 text-xs md:text-sm">
                  <Users className="h-3 w-3" />
                  {displayData.participant_count}/{maxParticipants === 0 ? '∞' : maxParticipants} {displayData.participant_count === 1 ? 'participant' : 'participants'}
                </Badge>
                {isFull && isOpen && (
                  <Badge variant="destructive" className="text-xs">
                    Full
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm md:text-base font-semibold mb-2">Description</h3>
            <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap break-words">{displayData.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs md:text-sm">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground flex-shrink-0">Created:</span>
              <span className="truncate">
                {displayData.created_at && displayData.created_at > 0
                  ? format(new Date(displayData.created_at * 1000), 'PPp')
                  : 'Recently'
                }
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm">
              <Clock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground flex-shrink-0">Duration:</span>
              <span>{formatDuration(displayData.duration_seconds)}</span>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground flex-shrink-0">Ends:</span>
              <span className="truncate">
                {displayData.end_time && displayData.end_time > 0
                  ? format(new Date(displayData.end_time * 1000), 'PPp')
                  : 'TBD'
                }
              </span>
            </div>
          </div>

          {/* Time Remaining / Ended Message */}
          {!hasEnded && !isResolved && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs md:text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2 flex-wrap">
                Time remaining: <CountdownTimer endTime={displayData.end_time} showIcon={false} />
              </div>
            </div>
          )}

          {hasEnded && !isResolved && (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-xs md:text-sm font-medium text-yellow-900 dark:text-yellow-100">
                This debate has ended. It can now be resolved.
              </p>
            </div>
          )}

          {/* Action Buttons and Forms */}
          <div className="space-y-4 pt-2">
            {/* Warning if debate is full */}
            {isFull && isOpen && !userHasJoined && (
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-900 dark:text-red-100 text-xs md:text-sm">
                  <strong>Debate is Full</strong>
                  <p className="mt-2 text-xs md:text-sm">This debate has reached the maximum of {maxParticipants} participants and is no longer accepting new arguments.</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Join Debate Button - Show when user can join */}
            {showJoinButton && !showForm && !submitSuccess && (
              <Button size="lg" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
                Join Debate
              </Button>
            )}

            {/* Join Debate Form - Show when user clicks Join Debate */}
            {showJoinButton && showForm && !submitSuccess && (
              <>
                {/* AI Judge Evaluation Criteria */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm md:text-base text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      AI Judge Evaluation Criteria
                    </CardTitle>
                    <CardDescription className="text-xs text-blue-700 dark:text-blue-300">
                      Your argument will be evaluated based on these weighted criteria:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-2 text-xs md:text-sm">
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.logic_reasoning || 25}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Logic & Reasoning</div>
                          <div className="text-blue-700 dark:text-blue-300">Is the argument logically sound and well-reasoned?</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.evidence_facts || 20}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Evidence & Facts</div>
                          <div className="text-blue-700 dark:text-blue-300">Does it provide credible evidence and facts?</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.clarity || 15}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Clarity</div>
                          <div className="text-blue-700 dark:text-blue-300">Is it clear and easy to understand?</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.relevance || 15}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Relevance</div>
                          <div className="text-blue-700 dark:text-blue-300">Is it relevant to the debate topic?</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.originality || 15}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Originality</div>
                          <div className="text-blue-700 dark:text-blue-300">Does it offer unique perspectives or creative insights?</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[45px] font-bold text-blue-900 dark:text-blue-100">{evaluationCriteria?.persuasiveness || 10}%</div>
                        <div>
                          <div className="font-semibold text-blue-900 dark:text-blue-100">Persuasiveness</div>
                          <div className="text-blue-700 dark:text-blue-300">How convincing and compelling is the argument?</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary">
                  <CardHeader className="pb-3 md:pb-6">
                    <CardTitle className="text-base md:text-lg">Submit Your Argument</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Write your argument for this debate (max {VALIDATION.ARGUMENT_MAX_LENGTH} characters)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Enter your argument here..."
                        value={argument}
                        onChange={(e) => setArgument(e.target.value)}
                        className="min-h-[120px] md:min-h-[150px] resize-none text-sm md:text-base"
                        maxLength={VALIDATION.ARGUMENT_MAX_LENGTH}
                        disabled={submitArgumentMutation.isPending}
                      />
                      <div className="flex items-center justify-between text-xs md:text-sm flex-wrap gap-2">
                        <span className={`text-muted-foreground ${argument.length > VALIDATION.ARGUMENT_MAX_LENGTH
                          ? 'text-destructive font-medium'
                          : ''
                          }`}>
                          {argument.length}/{VALIDATION.ARGUMENT_MAX_LENGTH} characters
                        </span>
                        {argument.length > 0 && argument.length <= VALIDATION.ARGUMENT_MAX_LENGTH && (
                          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4" />
                            Valid length
                          </span>
                        )}
                      </div>
                    </div>

                    {submitError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs md:text-sm">{submitError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSubmitArgument}
                        disabled={
                          submitArgumentMutation.isPending ||
                          !argument ||
                          argument.trim().length === 0 ||
                          argument.length > VALIDATION.ARGUMENT_MAX_LENGTH
                        }
                        className="flex-1 text-sm md:text-base"
                      >
                        {submitArgumentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Argument'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowForm(false);
                          setArgument('');
                          setSubmitError(null);
                        }}
                        disabled={submitArgumentMutation.isPending}
                        className="text-sm md:text-base"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Success Message - Show after successful submission */}
            {submitSuccess && userArgument && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  <strong>Argument submitted successfully!</strong>
                  <p className="mt-2 text-sm">Your argument has been recorded on the blockchain.</p>
                </AlertDescription>
              </Alert>
            )}

            {/* User's Submitted Argument - Show when user has already joined */}
            {userHasJoined && isOpen && userArgument && (
              <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="text-lg text-green-900 dark:text-green-100 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Your Submitted Argument
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    {userArgument.timestamp && userArgument.timestamp > 0 ? (
                      <>Submitted {formatDistanceToNow(new Date(userArgument.timestamp * 1000), { addSuffix: true })}</>
                    ) : (
                      <>Submitted recently</>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {/* Auto-Resolve Info - Show when debate has ended but not yet resolved */}
            {displayData.status === 'ENDED' && (
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100 text-xs md:text-sm">
                  <strong>AI is evaluating arguments...</strong>
                  <p className="mt-2 text-xs md:text-sm">Results will be revealed automatically once all evaluations are complete. This may take a few minutes.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Arguments, Participants, Leaderboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="arguments" className="text-xs md:text-sm py-2">Arguments</TabsTrigger>
          <TabsTrigger value="participants" className="text-xs md:text-sm py-2">Participants</TabsTrigger>
          <TabsTrigger value="leaderboard" disabled={!isResolved} className="text-xs md:text-sm py-2">
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arguments" className="mt-4 md:mt-6">
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base md:text-lg">Arguments</CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    All submitted arguments in chronological order (oldest first)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshFromBlockchain}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingArguments ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : debateArguments && debateArguments.length > 0 ? (
                <div className="space-y-4">
                  {debateArguments.map((arg, index: number) => {
                    const isCurrentUser = arg.author?.toLowerCase() === userAddress?.toLowerCase();
                    return (
                      <div
                        key={index}
                        className="rounded-lg p-4 md:p-5 space-y-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                      >
                        {/* Header with participant info and timestamp */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <AddressDisplay address={arg.author || ''} showCopy={true} />
                            {isCurrentUser && (
                              <Badge variant="default" className="text-xs px-2 py-0.5">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                            <Clock className="h-3 w-3" />
                            <span>
                              {arg.timestamp && arg.timestamp > 0
                                ? formatDistanceToNow(new Date(arg.timestamp * 1000), { addSuffix: true })
                                : 'Recently'
                              }
                            </span>
                          </div>
                        </div>

                        {/* Argument content */}
                        <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words text-blue-900 dark:text-blue-100">
                          {arg.content}
                        </div>

                        {/* Argument number badge */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs text-muted-foreground">
                            Argument #{index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {arg.timestamp && arg.timestamp > 0
                              ? format(new Date(arg.timestamp * 1000), 'PPp')
                              : 'Recently'
                            }
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No arguments submitted yet. Be the first to join!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Participants</CardTitle>
                  <CardDescription>
                    All users who have joined this debate
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshFromBlockchain}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingParticipants ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : participants && participants.length > 0 ? (
                <div className="space-y-3">
                  {participants.map((participant, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
                    >
                      <AddressDisplay address={participant.address || ''} showCopy={true} />
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        {participant.joined_at && participant.joined_at > 0
                          ? formatDistanceToNow(new Date(participant.joined_at * 1000), { addSuffix: true })
                          : 'Recently'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No participants yet. Be the first to join!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          {isLoadingResults ? (
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Loading results...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : results && results.all_scores && results.all_scores.length > 0 ? (
            <LeaderboardDisplay
              results={results}
              arguments={debateArguments || []}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>Final results and rankings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Trophy className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No results available yet. The debate must be resolved first.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Leaderboard Components
// ============================================================================

interface LeaderboardDisplayProps {
  results: {
    winner: string;
    winner_score: number;
    all_scores: Array<{
      address: string;
      score: number;
      reasoning: string;
      breakdown: {
        logic_reasoning: number;
        evidence_facts: number;
        clarity: number;
        relevance: number;
        originality: number;
        persuasiveness: number;
      };
    }>;
  };
  arguments: ArgumentInfo[];
}

function LeaderboardDisplay({ results, arguments: debateArguments }: LeaderboardDisplayProps) {
  // Ensure all_scores is an array
  if (!Array.isArray(results.all_scores)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Error loading results</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load leaderboard data. Please refresh the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Sort participants by score (highest first) and add rank
  const rankedParticipants = results.all_scores
    .map((score) => {
      const foundArgument = debateArguments.find(arg => arg.author?.toLowerCase() === score.address?.toLowerCase());

      return {
        address: score.address,
        score: score.score,
        reasoning: score.reasoning,
        breakdown: score.breakdown,
        argument: foundArgument?.content || 'No argument found',
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((participant, index) => ({
      ...participant,
      rank: index + 1,
    }));

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-base md:text-lg">Leaderboard</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Final rankings and AI evaluation results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankedParticipants.map((participant) => (
            <LeaderboardItem
              key={participant.address}
              rank={participant.rank}
              address={participant.address}
              score={participant.score}
              reasoning={participant.reasoning}
              argument={participant.argument}
              breakdown={participant.breakdown}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface LeaderboardItemProps {
  rank: number;
  address: string;
  score: number;
  reasoning: string;
  argument: string;
  breakdown?: {
    logic_reasoning: number;
    evidence_facts: number;
    clarity: number;
    relevance: number;
    originality: number;
    persuasiveness: number;
  };
}

function LeaderboardItem({ rank, address, score, reasoning, argument, breakdown }: LeaderboardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
      {/* Collapsed View - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-1.5 md:p-2 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors gap-2"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* Rank Badge */}
          <Badge variant="outline" className="font-semibold text-xs shrink-0 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100">
            #{rank}
          </Badge>

          {/* Address with copy icon */}
          <AddressDisplay address={address} showCopy={true} />
        </div>

        {/* Score and Dropdown Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100">{score}</span>
            <span className="text-xs text-blue-700 dark:text-blue-300 ml-1">/ 100</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-blue-700 dark:text-blue-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expanded View - Details */}
      {isExpanded && (
        <div className="px-3 md:px-4 py-3 md:py-4 space-y-3 border-t border-blue-200 dark:border-blue-800">
          {/* Star Rating */}
          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1.5">Rating</div>
            <StarRating score={score} showLabel />
          </div>

          {/* Argument */}
          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1.5">Argument</div>
            <div className="text-xs md:text-sm bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 p-3 rounded-md max-h-24 overflow-y-auto break-words">
              {argument}
            </div>
          </div>

          {/* Score Breakdown - Detailed Criteria */}
          {breakdown && (
            <div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">Score Breakdown</div>
              <div className="space-y-2">
                <CriteriaBar
                  label="Logic & Reasoning"
                  score={breakdown.logic_reasoning}
                  maxScore={25}
                  percentage={25}
                />
                <CriteriaBar
                  label="Evidence & Facts"
                  score={breakdown.evidence_facts}
                  maxScore={20}
                  percentage={20}
                />
                <CriteriaBar
                  label="Clarity"
                  score={breakdown.clarity}
                  maxScore={15}
                  percentage={15}
                />
                <CriteriaBar
                  label="Relevance"
                  score={breakdown.relevance}
                  maxScore={15}
                  percentage={15}
                />
                <CriteriaBar
                  label="Originality"
                  score={breakdown.originality}
                  maxScore={15}
                  percentage={15}
                />
                <CriteriaBar
                  label="Persuasiveness"
                  score={breakdown.persuasiveness}
                  maxScore={10}
                  percentage={10}
                />
              </div>
            </div>
          )}

          {/* AI Evaluation Summary */}
          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1.5">AI Evaluation Summary</div>
            <div className="text-xs md:text-sm bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 p-3 rounded-md max-h-24 overflow-y-auto break-words">
              {reasoning}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StarRatingProps {
  score: number;
  showLabel?: boolean;
}

function StarRating({ score, showLabel = false }: StarRatingProps) {
  // Calculate stars: floor(score/20) = 0-5 stars
  const starCount = Math.floor(score / 20);
  const stars = Array.from({ length: 5 }, (_, i) => i < starCount);

  return (
    <div className="flex items-center gap-1">
      {stars.map((filled, index) => (
        <span
          key={index}
          className={`text-base md:text-lg ${filled ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
        >
          {filled ? '★' : '☆'}
        </span>
      ))}
      {showLabel && (
        <span className="text-xs text-muted-foreground ml-1">
          ({starCount}/5)
        </span>
      )}
    </div>
  );
}

interface CriteriaBarProps {
  label: string;
  score: number;
  maxScore: number;
  percentage: number;
}

function CriteriaBar({ label, score, maxScore, percentage }: CriteriaBarProps) {
  // Calculate percentage for progress bar
  const progressPercentage = (score / maxScore) * 100;

  // Determine color based on percentage achieved
  const getColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-500';
    if (percent >= 60) return 'bg-blue-500';
    if (percent >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const color = getColor(progressPercentage);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-blue-900 dark:text-blue-100 font-medium">
          {label} <span className="text-blue-700 dark:text-blue-300">({percentage}%)</span>
        </span>
        <span className="text-blue-900 dark:text-blue-100 font-semibold">
          {score}/{maxScore}
        </span>
      </div>
      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}

interface ScoreProgressBarProps {
  score: number;
}

function ScoreProgressBar({ score }: ScoreProgressBarProps) {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const color = getColor(score);

  return (
    <div className="space-y-1">
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className="font-semibold">{score}</span>
        <span>100</span>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function DebateDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    return `${Math.round(seconds / 60)} minutes`;
  } else if (hours < 24) {
    return `${Math.round(hours)} ${hours === 1 ? 'hour' : 'hours'}`;
  } else {
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
}
