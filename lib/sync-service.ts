/**
 * Sync Service for Blockchain-Database Synchronization
 * 
 * This service keeps the Supabase database cache synchronized with blockchain state.
 * The blockchain is the source of truth, and the database provides fast queries.
 * 
 * All sync functions are idempotent (safe to call multiple times).
 */

import { supabaseApi } from './supabase-client';
import * as genlayerClient from './genlayer-client';
import { logSync, logger, LogCategory } from './logger';

/**
 * Metadata for a newly created debate
 */
export interface DebateMetadata {
  topic: string;
  description: string;
  durationMinutes: number;
  creatorId: string; // Supabase user UUID
}

/**
 * Results from debate resolution
 */
export interface ResolutionResults {
  winner: string;
  winner_score: number;
  all_scores: Array<{
    address: string;
    score: number;
    reasoning: string;
  }>;
}

/**
 * Sync a newly created debate to the database after contract deployment
 * 
 * @param contractAddress - The deployed contract address
 * @param metadata - Debate metadata (topic, description, duration, creator)
 * @returns The created debate record
 * @throws Error if sync fails
 * 
 * Requirements: 11.1 - Database synchronization for debate creation
 */
export async function syncDebateCreation(
  contractAddress: string,
  metadata: DebateMetadata
): Promise<void> {
  const startTime = Date.now();
  logSync.start('syncDebateCreation', contractAddress);

  try {
    // Check if debate already exists (idempotency)
    let existingDebate;
    try {
      existingDebate = await supabaseApi.getDebateByAddress(contractAddress);
    } catch (error) {
      // Log the error but continue - might be a 406 or other API issue
      logger.warn(LogCategory.SYNC, 'Error checking existing debate, will attempt to create', {
        contractAddress,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
    }

    if (existingDebate) {
      logger.info(LogCategory.SYNC, 'Debate already synced, skipping', {
        contractAddress,
        metadata: { debateId: existingDebate.id }
      });
      logSync.complete('syncDebateCreation', contractAddress, Date.now() - startTime);
      return;
    }

    // Fetch debate info from blockchain to get accurate timestamps
    const debateInfo = await genlayerClient.getDebateInfo(contractAddress);

    // Calculate end_time as Date object
    const endTime = new Date(debateInfo.end_time * 1000);

    // Create debate record in database
    await supabaseApi.createDebate({
      contract_address: contractAddress,
      topic: metadata.topic,
      description: metadata.description,
      duration_minutes: metadata.durationMinutes,
      end_time: endTime,
      status: debateInfo.status as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
      participant_count: 0,
      last_synced_at: new Date(),
    });

    const duration = Date.now() - startTime;
    logSync.complete('syncDebateCreation', contractAddress, duration);

    logger.info(LogCategory.SYNC, 'Debate creation synced successfully', {
      contractAddress,
      metadata: { topic: metadata.topic, duration }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSync.error(
      'Failed to sync debate creation',
      error instanceof Error ? error : new Error(String(error)),
      contractAddress,
      'syncDebateCreation'
    );
    // Throw error so CreateDebateForm knows sync failed and can queue it
    throw error;
  }
}

/**
 * Sync a participant join event to the database
 * 
 * @param contractAddress - The debate contract address
 * @param participantAddress - The participant's wallet address
 * @param argument - The submitted argument content
 * @returns The created participant and argument records
 * @throws Error if sync fails
 * 
 * Requirements: 11.2 - Database synchronization for participant join
 * Requirements: 11.4 - Update participant_count when participants join
 */
export async function syncParticipantJoin(
  contractAddress: string,
  participantAddress: string,
  argument: string
): Promise<void> {
  const startTime = Date.now();
  logSync.start('syncParticipantJoin', contractAddress);

  try {
    // Get debate record from database
    const debate = await supabaseApi.getDebateByAddress(contractAddress);
    if (!debate) {
      throw new Error(`Debate not found in database: ${contractAddress}`);
    }

    // Check if participant already exists (idempotency)
    const hasJoined = await supabaseApi.hasUserJoined(debate.id, participantAddress);
    if (hasJoined) {
      logger.info(LogCategory.SYNC, 'Participant already synced, skipping', {
        contractAddress,
        metadata: { participantAddress }
      });
      return;
    }

    // PHASE 1: QUICK RETRY (3 attempts × 5 seconds = 15 seconds total)
    // This handles most cases where blockchain is reasonably fast
    let participants;
    let participantData;
    let retries = 0;
    const maxQuickRetries = 3;
    const quickDelay = 5000; // 5 seconds

    logger.info(LogCategory.SYNC, 'Starting quick retry phase', {
      contractAddress,
      metadata: { participantAddress, maxQuickRetries, delayMs: quickDelay }
    });

    while (retries < maxQuickRetries) {
      participants = await genlayerClient.getParticipants(contractAddress);
      participantData = participants.find(p => p.address?.toLowerCase() === participantAddress?.toLowerCase());

      if (participantData) {
        logger.info(LogCategory.SYNC, 'Participant found in quick retry phase', {
          contractAddress,
          metadata: { participantAddress, attempt: retries + 1 }
        });
        break; // Found the participant, exit retry loop
      }

      // If not found and we have retries left, wait and try again
      if (retries < maxQuickRetries - 1) {
        logger.info(LogCategory.SYNC, 'Quick retry: Participant not found, waiting...', {
          contractAddress,
          metadata: {
            participantAddress,
            attempt: retries + 1,
            maxQuickRetries,
            delayMs: quickDelay
          }
        });
        await new Promise(resolve => setTimeout(resolve, quickDelay));
      }

      retries++;
    }

    // PHASE 2: QUEUE FOR BACKGROUND JOB
    // If quick retries failed, queue for background processing
    if (!participantData) {
      logger.warn(LogCategory.SYNC, 'Quick retries exhausted, queueing for background sync', {
        contractAddress,
        metadata: {
          participantAddress,
          quickRetries: maxQuickRetries,
          totalQuickTime: maxQuickRetries * quickDelay
        }
      });

      // Queue the sync operation for background job
      try {
        const nextRetryAt = new Date(Date.now() + 60000); // Retry in 1 minute

        await supabaseApi.queueSyncOperation({
          sync_type: 'participant_join',
          contract_address: contractAddress,
          participant_address: participantAddress,
          payload: {
            argument,
            debate_id: debate.id,
          },
          attempts: 0,
          max_attempts: 10, // Background job will retry up to 10 times
          next_retry_at: nextRetryAt,
          status: 'pending',
          last_error: null,
        });

        const duration = Date.now() - startTime;
        logger.info(LogCategory.SYNC, 'Participant join queued for background sync', {
          contractAddress,
          metadata: {
            participantAddress,
            nextRetryAt: nextRetryAt.toISOString(),
            duration
          }
        });

        // Don't throw error - this is non-blocking
        // Background job will handle the sync later
        return;

      } catch (queueError) {
        logger.error(
          LogCategory.SYNC,
          'Failed to queue sync operation',
          queueError instanceof Error ? queueError : new Error(String(queueError)),
          {
            contractAddress,
            metadata: {
              participantAddress,
            }
          }
        );
        // Even if queueing fails, don't throw - this is non-blocking
        return;
      }
    }

    // PHASE 3: SYNC TO DATABASE
    // Participant found, proceed with database sync
    logger.info(LogCategory.SYNC, 'Participant found, syncing to database', {
      contractAddress,
      metadata: { participantAddress }
    });

    // Create participant record
    const participant = await supabaseApi.createParticipant({
      debate_id: debate.id,
      contract_address: contractAddress,
      participant_address: participantAddress,
      joined_at: participantData.joined_at,
      has_submitted: true,
    });

    // Create argument record
    await supabaseApi.createArgument({
      debate_id: debate.id,
      contract_address: contractAddress,
      author_address: participantAddress,
      content: argument,
      timestamp: participantData.joined_at,
    });

    // Update participant count in debates table
    const newParticipantCount = debate.participant_count + 1;
    await supabaseApi.updateDebate(debate.id, {
      participant_count: newParticipantCount,
    });

    // Update debate status if this is the first participant (OPEN -> ONGOING)
    if (debate.status === 'OPEN' && newParticipantCount === 1) {
      await supabaseApi.updateDebate(debate.id, {
        status: 'ONGOING',
      });
      logger.info(LogCategory.SYNC, 'Debate status updated to ONGOING', {
        contractAddress,
        metadata: { debateId: debate.id }
      });
    }

    // PHASE 4: QUEUE FOR AI EVALUATION
    // Add to evaluation queue for real-time AI processing
    try {
      await supabaseApi.queueEvaluation({
        debate_id: debate.id,
        contract_address: contractAddress,
        participant_address: participantAddress,
        argument_content: argument,
        debate_topic: debate.topic,
        debate_description: debate.description,
        status: 'pending',
      });
      logger.info(LogCategory.SYNC, 'Evaluation queued for AI processing', {
        contractAddress,
        metadata: { participantAddress }
      });
    } catch (evalQueueError) {
      // Log but don't fail - evaluation queue is non-critical
      logger.warn(LogCategory.SYNC, 'Failed to queue evaluation (non-critical)', {
        contractAddress,
        metadata: {
          participantAddress,
          error: evalQueueError instanceof Error ? evalQueueError.message : String(evalQueueError)
        }
      });
    }

    const duration = Date.now() - startTime;
    logSync.complete('syncParticipantJoin', contractAddress, duration);

    logger.info(LogCategory.SYNC, 'Participant join synced successfully', {
      contractAddress,
      metadata: { participantAddress, participantCount: newParticipantCount, duration }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSync.error(
      'Failed to sync participant join',
      error instanceof Error ? error : new Error(String(error)),
      contractAddress,
      'syncParticipantJoin'
    );
    throw new Error(`Failed to sync participant join: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sync debate resolution results to the database
 * 
 * @param contractAddress - The debate contract address
 * @param results - Resolution results (winner, scores, reasoning)
 * @returns The updated debate record
 * @throws Error if sync fails
 * 
 * Requirements: 11.3 - Database synchronization for debate resolution
 */
export async function syncDebateResolution(
  contractAddress: string,
  results: ResolutionResults
): Promise<void> {
  const startTime = Date.now();
  logSync.start('syncDebateResolution', contractAddress);

  try {
    // Get debate record from database
    const debate = await supabaseApi.getDebateByAddress(contractAddress);
    if (!debate) {
      throw new Error(`Debate not found in database: ${contractAddress}`);
    }

    // Check if already resolved (idempotency)
    if (debate.status === 'RESOLVED') {
      logger.info(LogCategory.SYNC, 'Debate already resolved, skipping', {
        contractAddress,
        metadata: { debateId: debate.id }
      });
      return;
    }

    // Update debate status to RESOLVED
    await supabaseApi.updateDebate(debate.id, {
      status: 'RESOLVED',
    });

    const duration = Date.now() - startTime;
    logSync.complete('syncDebateResolution', contractAddress, duration);

    logger.info(LogCategory.SYNC, 'Debate resolution synced successfully', {
      contractAddress,
      metadata: {
        winner: results.winner,
        winnerScore: results.winner_score,
        participantCount: results.all_scores.length,
        duration
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logSync.error(
      'Failed to sync debate resolution',
      error instanceof Error ? error : new Error(String(error)),
      contractAddress,
      'syncDebateResolution'
    );
    throw new Error(`Failed to sync debate resolution: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check and update debate status based on blockchain state
 * 
 * This function checks if a debate has ended (time-based) and updates the status
 * from ONGOING to ENDED. It can be called periodically or when viewing a debate.
 * 
 * @param contractAddress - The debate contract address
 * @returns The updated debate status, or null if no update was needed
 * @throws Error if sync fails
 * 
 * Requirements: 11.5 - Sync debate status changes from smart contract to database
 * Requirements: 7.3 - Update status from ONGOING to ENDED when time expires
 */
export async function syncDebateStatus(
  contractAddress: string
): Promise<string | null> {
  const startTime = Date.now();
  logSync.start('syncDebateStatus', contractAddress);

  try {
    // Get debate record from database
    const debate = await supabaseApi.getDebateByAddress(contractAddress);
    if (!debate) {
      throw new Error(`Debate not found in database: ${contractAddress}`);
    }

    // Skip if already ENDED or RESOLVED
    if (debate.status === 'ENDED' || debate.status === 'RESOLVED') {
      logger.debug(LogCategory.SYNC, 'Debate already ended or resolved, skipping', {
        contractAddress,
        metadata: { status: debate.status }
      });
      return null;
    }

    // Fetch current debate info from blockchain
    const debateInfo = await genlayerClient.getDebateInfo(contractAddress);

    // Check if status has changed
    if (debateInfo.status !== debate.status) {
      // Update database with new status
      await supabaseApi.updateDebate(debate.id, {
        status: debateInfo.status as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
      });

      const duration = Date.now() - startTime;
      logSync.complete('syncDebateStatus', contractAddress, duration);

      logger.info(LogCategory.SYNC, 'Debate status synced successfully', {
        contractAddress,
        metadata: {
          oldStatus: debate.status,
          newStatus: debateInfo.status,
          duration
        }
      });

      return debateInfo.status;
    }

    // Also check if debate has ended based on time (blockchain might not have updated yet)
    // Note: We use genlayer-client for this as it's a simple boolean check
    const isEnded = await genlayerClient.isDebateEnded(contractAddress);
    if (isEnded && debate.status === 'ONGOING') {
      // Update status to ENDED
      await supabaseApi.updateDebate(debate.id, {
        status: 'ENDED',
      });

      const duration = Date.now() - startTime;
      logSync.complete('syncDebateStatus', contractAddress, duration);

      logger.info(LogCategory.SYNC, 'Debate status updated to ENDED (time-based)', {
        contractAddress,
        metadata: { duration }
      });

      return 'ENDED';
    }

    const duration = Date.now() - startTime;
    logger.debug(LogCategory.SYNC, 'Debate status unchanged', {
      contractAddress,
      metadata: { status: debate.status, duration }
    });

    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    logSync.error(
      'Failed to sync debate status',
      error instanceof Error ? error : new Error(String(error)),
      contractAddress,
      'syncDebateStatus'
    );
    throw new Error(`Failed to sync debate status: ${error instanceof Error ? error.message : String(error)}`);
  }
}


// ============================================================================
// HYBRID CACHING SYNC FUNCTIONS
// ============================================================================

/**
 * Sync arguments from blockchain to database cache
 * Non-blocking operation - errors are logged but don't fail the main operation
 */
export async function syncArgumentsToDatabase(
  contractAddress: string,
  argumentsData: Array<{
    author: string;
    content: string;
    timestamp: number;
  }>
): Promise<void> {
  try {
    await supabaseApi.syncArguments(contractAddress, argumentsData);
  } catch (error) {
    console.error('Failed to sync arguments to database:', error);
    logger.error(
      LogCategory.SYNC,
      'Arguments sync failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        contractAddress,
        metadata: {
          argumentCount: argumentsData.length,
        },
      }
    );
  }
}

/**
 * Sync participants from blockchain to database cache
 * Non-blocking operation - errors are logged but don't fail the main operation
 */
export async function syncParticipantsToDatabase(
  contractAddress: string,
  participantsData: Array<{
    address: string;
    joined_at: number;
    has_submitted: boolean;
  }>
): Promise<void> {
  try {
    await supabaseApi.syncParticipants(contractAddress, participantsData);
  } catch (error) {
    console.error('Failed to sync participants to database:', error);
    logger.error(
      LogCategory.SYNC,
      'Participants sync failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        contractAddress,
        metadata: {
          participantCount: participantsData.length,
        },
      }
    );
  }
}

/**
 * Sync leaderboard results from blockchain to database cache
 * Non-blocking operation - errors are logged but don't fail the main operation
 * Updated for 6-criteria scoring system (v0.2.0)
 */
export async function syncLeaderboardToDatabase(
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
): Promise<void> {
  try {
    await supabaseApi.syncLeaderboard(contractAddress, results);
  } catch (error) {
    console.error('Failed to sync leaderboard to database:', error);
    logger.error(
      LogCategory.SYNC,
      'Leaderboard sync failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        contractAddress,
        metadata: {
          resultCount: results.all_scores.length,
        },
      }
    );
  }
}
