/**
 * Supabase client configuration
 * Provides typed interface for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { handleError, retryWithBackoff, getRetryConfig } from './error-handler';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http');

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase environment variables not configured. Database features will not work.');
  console.warn('   Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// Create Supabase client with fallback to prevent initialization errors
// Use a dummy URL if not configured
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // We use Privy for auth, not Supabase
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    },
  })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

// Export configuration status
export const isConfigured = isSupabaseConfigured;

// Helper to check if Supabase is ready before operations
function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please set environment variables.');
  }
}

/**
 * Wrapper for database operations with automatic retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await retryWithBackoff(
      operation,
      { maxAttempts: 1, delayMs: 1000, exponentialBackoff: false },
      (attempt, error) => {
        console.log(`Retrying database operation (attempt ${attempt})...`);
      }
    );
  } catch (error) {
    const errorInfo = handleError(error, context);
    throw new Error(errorInfo.message);
  }
}

// Database types (will be expanded in Task 4 and 5)
export interface User {
  id: string;
  privy_user_id: string;
  wallet_address: string | null;
  email: string | null;
  created_at: Date;
}

export interface Debate {
  id: string;
  contract_address: string;
  topic: string;
  description: string;
  duration_minutes: number;
  created_at: Date;
  end_time: Date;
  status: 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED';
  participant_count: number;
  max_participants?: number; // Optional for backward compatibility
  evaluation_criteria?: string | Record<string, number>; // JSON string or parsed object
  last_synced_at: Date | null; // Timestamp of last blockchain sync
  updated_at: Date;
}

export interface Participant {
  id: string;
  debate_id: string;
  contract_address: string;
  participant_address: string;
  joined_at: number; // BIGINT timestamp
  has_submitted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Argument {
  id: string;
  debate_id: string;
  contract_address: string;
  author_address: string;
  content: string;
  timestamp: number; // BIGINT timestamp
  created_at: Date;
  updated_at: Date;
}

export interface SyncQueueItem {
  id: string;
  sync_type: 'debate_creation' | 'participant_join' | 'debate_resolution';
  contract_address: string;
  participant_address: string | null;
  payload: Record<string, any>;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

/**
 * Evaluation queue item for real-time AI evaluation
 */
export interface EvaluationQueueItem {
  id?: string;
  debate_id: string;
  contract_address: string;
  participant_address: string;
  argument_content: string;
  debate_topic: string;
  debate_description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: number;
  attempts?: number;
  max_attempts?: number;
  last_error?: string | null;
  created_at?: Date;
  processing_started_at?: Date | null;
  completed_at?: Date | null;
}

/**
 * Supabase API functions for database operations
 * Provides typed interface for all database queries and mutations
 */
export const supabaseApi = {
  // ============================================================================
  // User Management Functions
  // ============================================================================

  /**
   * Get user by Privy user ID
   * @param privyUserId - Privy user identifier
   * @returns User object or null if not found
   */
  async getUserByPrivyId(privyUserId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('privy_user_id', privyUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - user doesn't exist
        return null;
      }
      console.error('Error fetching user by Privy ID:', error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data as User;
  },

  /**
   * Create a new user record
   * @param user - User data (without id and created_at)
   * @returns Created user object
   */
  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        privy_user_id: user.privy_user_id,
        wallet_address: user.wallet_address,
        email: user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data as User;
  },

  /**
   * Update user fields
   * @param id - User UUID
   * @param updates - Partial user object with fields to update
   * @returns Updated user object
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data as User;
  },

  // ============================================================================
  // Debate Query Functions
  // ============================================================================

  /**
   * Get debates with optional filters
   * @param filters - Optional filters for status
   * @returns Array of debate objects ordered by creation time (newest first)
   */
  async getDebates(filters?: { status?: string }): Promise<Debate[]> {
    ensureConfigured();

    return withRetry(async () => {
      let query = supabase
        .from('debates')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching debates:', error);
        throw new Error(`Failed to fetch debates: ${error.message}`);
      }

      return data as Debate[];
    }, { operation: 'getDebates', filters });
  },

  /**
   * Get single debate by contract address
   * @param contractAddress - Blockchain contract address
   * @returns Debate object or null if not found
   */
  async getDebateByAddress(contractAddress: string): Promise<Debate | null> {
    ensureConfigured();

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('debates')
        .select('*')
        .eq('contract_address', contractAddress)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - debate doesn't exist
          return null;
        }
        console.error('Error fetching debate by address:', error);
        throw new Error(`Failed to fetch debate: ${error.message}`);
      }

      return data as Debate;
    }, { operation: 'getDebateByAddress', contractAddress });
  },

  /**
   * Create a new debate record
   * @param debate - Debate data (without id and created_at)
   * @returns Created debate object
   */
  async createDebate(debate: Omit<Debate, 'id' | 'created_at' | 'updated_at'>): Promise<Debate> {
    ensureConfigured();

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('debates')
        .insert({
          contract_address: debate.contract_address,
          topic: debate.topic,
          description: debate.description,
          duration_minutes: debate.duration_minutes,
          end_time: debate.end_time,
          status: debate.status,
          participant_count: debate.participant_count || 0,
          max_participants: (debate.max_participants !== undefined && debate.max_participants !== null) ? debate.max_participants : 10,
          evaluation_criteria: debate.evaluation_criteria ? JSON.stringify(debate.evaluation_criteria) : null,
          last_synced_at: debate.last_synced_at || null,
          // @ts-ignore - Local type definition issue
          image_url: (debate as any).image_url || null,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating debate:', error);
        throw new Error(`Failed to create debate: ${error.message}`);
      }

      return data as Debate;
    }, { operation: 'createDebate', contractAddress: debate.contract_address });
  },

  /**
   * Update debate fields
   * @param id - Debate UUID
   * @param updates - Partial debate object with fields to update
   * @returns Updated debate object
   */
  async updateDebate(id: string, updates: Partial<Debate>): Promise<Debate> {
    const { data, error } = await supabase
      .from('debates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating debate:', error);
      throw new Error(`Failed to update debate: ${error.message}`);
    }

    return data as Debate;
  },

  // ============================================================================
  // Participant Query Functions
  // ============================================================================

  /**
   * Get all participants for a debate
   * @param debateId - Debate UUID
   * @returns Array of participant objects
   */
  async getParticipants(debateId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('debate_id', debateId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching participants:', error);
      throw new Error(`Failed to fetch participants: ${error.message}`);
    }

    return data as Participant[];
  },

  /**
   * Create a new participant record
   * @param participant - Participant data (without id, created_at, updated_at)
   * @returns Created participant object
   */
  async createParticipant(participant: Omit<Participant, 'id' | 'created_at' | 'updated_at'>): Promise<Participant> {
    const { data, error } = await supabase
      .from('participants')
      .insert({
        debate_id: participant.debate_id,
        contract_address: participant.contract_address,
        participant_address: participant.participant_address,
        joined_at: participant.joined_at,
        has_submitted: participant.has_submitted,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating participant:', error);
      throw new Error(`Failed to create participant: ${error.message}`);
    }

    return data as Participant;
  },

  /**
   * Check if a user has joined a debate
   * @param debateId - Debate UUID
   * @param walletAddress - User wallet address
   * @returns True if user has joined, false otherwise
   */
  async hasUserJoined(debateId: string, walletAddress: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('participants')
      .select('id')
      .eq('debate_id', debateId)
      .eq('participant_address', walletAddress)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - user hasn't joined
        return false;
      }
      console.error('Error checking if user joined:', error);
      throw new Error(`Failed to check user participation: ${error.message}`);
    }

    return data !== null;
  },

  // ============================================================================
  // Argument Query Functions
  // ============================================================================

  /**
   * Get all arguments for a debate
   * @param debateId - Debate UUID
   * @returns Array of argument objects ordered by timestamp (oldest first)
   */
  async getArguments(debateId: string): Promise<Argument[]> {
    const { data, error } = await supabase
      .from('arguments')
      .select('*')
      .eq('debate_id', debateId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching arguments:', error);
      throw new Error(`Failed to fetch arguments: ${error.message}`);
    }

    return data as Argument[];
  },

  /**
   * Create a new argument record
   * @param argument - Argument data (without id, created_at, updated_at)
   * @returns Created argument object
   */
  async createArgument(argument: Omit<Argument, 'id' | 'created_at' | 'updated_at'>): Promise<Argument> {
    const { data, error } = await supabase
      .from('arguments')
      .insert({
        debate_id: argument.debate_id,
        contract_address: argument.contract_address,
        author_address: argument.author_address,
        content: argument.content,
        timestamp: argument.timestamp,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating argument:', error);
      throw new Error(`Failed to create argument: ${error.message}`);
    }

    return data as Argument;
  },

  // ============================================================================
  // Sync Queue Functions
  // ============================================================================

  /**
   * Queue a sync operation for background processing
   * @param queueItem - Sync queue item data
   * @returns Created sync queue item
   */
  async queueSyncOperation(queueItem: Omit<SyncQueueItem, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Promise<SyncQueueItem> {
    const { data, error } = await supabase
      .from('sync_queue')
      .insert({
        sync_type: queueItem.sync_type,
        contract_address: queueItem.contract_address,
        participant_address: queueItem.participant_address,
        payload: queueItem.payload,
        attempts: queueItem.attempts,
        max_attempts: queueItem.max_attempts,
        next_retry_at: queueItem.next_retry_at,
        status: queueItem.status,
        last_error: queueItem.last_error,
      })
      .select()
      .single();

    if (error) {
      console.error('Error queueing sync operation:', error);
      throw new Error(`Failed to queue sync operation: ${error.message}`);
    }

    return data as SyncQueueItem;
  },

  /**
   * Get pending sync operations ready for processing
   * @param limit - Maximum number of items to fetch
   * @returns Array of pending sync queue items
   */
  async getPendingSyncOperations(limit: number = 10): Promise<SyncQueueItem[]> {
    const { data, error } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching pending sync operations:', error);
      throw new Error(`Failed to fetch pending sync operations: ${error.message}`);
    }

    return data as SyncQueueItem[];
  },

  /**
   * Update sync queue item status and retry info
   * @param id - Sync queue item ID
   * @param updates - Partial sync queue item with fields to update
   * @returns Updated sync queue item
   */
  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<SyncQueueItem> {
    const { data, error } = await supabase
      .from('sync_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sync queue item:', error);
      throw new Error(`Failed to update sync queue item: ${error.message}`);
    }

    return data as SyncQueueItem;
  },

  /**
   * Get sync queue statistics
   * @returns Object with counts by status
   */
  async getSyncQueueStats(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('sync_queue')
      .select('status');

    if (error) {
      console.error('Error fetching sync queue stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    data.forEach((item: any) => {
      stats[item.status as keyof typeof stats]++;
    });

    return stats;
  },

  // ============================================================================
  // ARGUMENTS METHODS (for hybrid caching)
  // ============================================================================

  /**
   * Get arguments by contract address from database cache
   */
  async getArgumentsByContractAddress(contractAddress: string) {
    ensureConfigured();

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('arguments')
        .select('*')
        .eq('contract_address', contractAddress)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data;
    }, { operation: 'getArgumentsByContractAddress', contractAddress });
  },

  /**
   * Sync arguments to database cache
   */
  async syncArguments(
    contractAddress: string,
    argumentsData: Array<{
      author: string;
      content: string;
      timestamp: number;
    }>
  ) {
    ensureConfigured();

    // Get debate ID from contract address
    const debate = await this.getDebateByAddress(contractAddress);
    if (!debate) {
      console.warn(`Debate not found for contract ${contractAddress}`);
      return;
    }

    return withRetry(async () => {
      // Upsert arguments (insert or update if exists)
      const argumentsToSync = argumentsData.map(arg => ({
        debate_id: debate.id,
        contract_address: contractAddress,
        author_address: arg.author,
        content: arg.content,
        timestamp: arg.timestamp,
      }));

      const { error } = await supabase
        .from('arguments')
        .upsert(argumentsToSync, {
          onConflict: 'debate_id,author_address',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log(`✅ Synced ${argumentsData.length} arguments to database for ${contractAddress}`);
    }, { operation: 'syncArguments', contractAddress, count: argumentsData.length });
  },

  // ============================================================================
  // PARTICIPANTS METHODS (for hybrid caching)
  // ============================================================================

  /**
   * Get participants by contract address from database cache
   */
  async getParticipantsByContractAddress(contractAddress: string) {
    ensureConfigured();

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('contract_address', contractAddress)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data;
    }, { operation: 'getParticipantsByContractAddress', contractAddress });
  },

  /**
   * Sync participants to database cache
   */
  async syncParticipants(
    contractAddress: string,
    participantsData: Array<{
      address: string;
      joined_at: number;
      has_submitted: boolean;
    }>
  ) {
    ensureConfigured();

    // Get debate ID from contract address
    const debate = await this.getDebateByAddress(contractAddress);
    if (!debate) {
      console.warn(`Debate not found for contract ${contractAddress}`);
      return;
    }

    return withRetry(async () => {
      // Upsert participants (insert or update if exists)
      const participantsToSync = participantsData.map(p => ({
        debate_id: debate.id,
        contract_address: contractAddress,
        participant_address: p.address,
        joined_at: p.joined_at,
        has_submitted: p.has_submitted,
      }));

      const { error } = await supabase
        .from('participants')
        .upsert(participantsToSync, {
          onConflict: 'debate_id,participant_address',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log(`✅ Synced ${participantsData.length} participants to database for ${contractAddress}`);
    }, { operation: 'syncParticipants', contractAddress, count: participantsData.length });
  },

  // ============================================================================
  // LEADERBOARD METHODS (for hybrid caching)
  // ============================================================================

  /**
   * Get leaderboard by contract address from database cache
   * Updated for 6-criteria scoring system (v0.2.0)
   */
  async getLeaderboardByContractAddress(contractAddress: string): Promise<{
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
  } | null> {
    ensureConfigured();

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('leaderboard_results')
        .select('*')
        .eq('contract_address', contractAddress)
        .order('score', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) return null;

      // Find winner
      const winner = data.find((r: { is_winner: boolean; participant_address: string; score: number; reasoning: string; logic_reasoning: number; evidence_facts: number; clarity: number; relevance: number; originality: number; persuasiveness: number }) => r.is_winner);

      return {
        winner: winner?.participant_address || data[0].participant_address,
        winner_score: winner?.score || data[0].score,
        all_scores: data.map((r: { is_winner: boolean; participant_address: string; score: number; reasoning: string; logic_reasoning: number; evidence_facts: number; clarity: number; relevance: number; originality: number; persuasiveness: number }) => ({
          address: r.participant_address,
          score: r.score,
          reasoning: r.reasoning,
          breakdown: {
            logic_reasoning: r.logic_reasoning || 0,
            evidence_facts: r.evidence_facts || 0,
            clarity: r.clarity || 0,
            relevance: r.relevance || 0,
            originality: r.originality || 0,
            persuasiveness: r.persuasiveness || 0,
          },
        })),
      };
    }, { operation: 'getLeaderboardByContractAddress', contractAddress });
  },

  /**
   * Sync leaderboard results to database cache
   * Updated for 6-criteria scoring system (v0.2.0)
   */
  async syncLeaderboard(
    contractAddress: string,
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
    }
  ) {
    ensureConfigured();

    // Get debate ID from contract address
    const debate = await this.getDebateByAddress(contractAddress);
    if (!debate) {
      console.warn(`Debate not found for contract ${contractAddress}`);
      return;
    }

    return withRetry(async () => {
      // Prepare leaderboard data with ranks and breakdown
      const leaderboardToSync = results.all_scores
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map((score, index) => ({
          debate_id: debate.id,
          contract_address: contractAddress,
          participant_address: score.address,
          score: score.score,
          reasoning: score.reasoning,
          rank: index + 1,
          is_winner: score.address.toLowerCase() === results.winner.toLowerCase(),
          logic_reasoning: score.breakdown.logic_reasoning,
          evidence_facts: score.breakdown.evidence_facts,
          clarity: score.breakdown.clarity,
          relevance: score.breakdown.relevance,
          originality: score.breakdown.originality,
          persuasiveness: score.breakdown.persuasiveness,
        }));

      const { error } = await supabase
        .from('leaderboard_results')
        .upsert(leaderboardToSync, {
          onConflict: 'debate_id,participant_address',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log(`✅ Synced leaderboard (${results.all_scores.length} results) to database for ${contractAddress}`);
    }, { operation: 'syncLeaderboard', contractAddress, count: results.all_scores.length });
  },

  // ============================================================================
  // EVALUATION QUEUE FUNCTIONS (for real-time AI evaluation)
  // ============================================================================

  /**
   * Queue an argument for AI evaluation
   * @param queueItem - Evaluation queue item data
   * @returns Created evaluation queue item
   */
  async queueEvaluation(queueItem: Omit<EvaluationQueueItem, 'id' | 'created_at' | 'processing_started_at' | 'completed_at'>): Promise<EvaluationQueueItem> {
    ensureConfigured();

    const { data, error } = await supabase
      .from('evaluation_queue')
      .insert({
        debate_id: queueItem.debate_id,
        contract_address: queueItem.contract_address,
        participant_address: queueItem.participant_address,
        argument_content: queueItem.argument_content,
        debate_topic: queueItem.debate_topic,
        debate_description: queueItem.debate_description,
        status: queueItem.status || 'pending',
        priority: queueItem.priority || 0,
        attempts: queueItem.attempts || 0,
        max_attempts: queueItem.max_attempts || 3,
        last_error: queueItem.last_error || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error queueing evaluation:', error);
      throw new Error(`Failed to queue evaluation: ${error.message}`);
    }

    return data as EvaluationQueueItem;
  },
};
