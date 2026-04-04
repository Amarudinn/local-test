import { NextRequest, NextResponse } from 'next/server';
import { supabaseApi } from '@/lib/supabase-client';
import * as genlayerClient from '@/lib/genlayer-client';
import { logger, LogCategory } from '@/lib/logger';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
  
  if (!authHeader) {
    return false;
  }
  
  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const startTime = Date.now();
  logger.info(LogCategory.SYNC, 'Background sync job started', {
    metadata: { timestamp: new Date().toISOString() }
  });
  
  try {
    const pendingOps = await supabaseApi.getPendingSyncOperations(10);
    
    if (pendingOps.length === 0) {
      logger.info(LogCategory.SYNC, 'No pending sync operations', {
        metadata: { duration: Date.now() - startTime }
      });
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending operations'
      });
    }
    
    logger.info(LogCategory.SYNC, 'Processing pending sync operations', {
      metadata: { count: pendingOps.length }
    });
    
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      queued: 0,
    };
    
    for (const op of pendingOps) {
      results.processed++;
      
      try {
        await supabaseApi.updateSyncQueueItem(op.id, {
          status: 'processing',
        });
        
        if (op.sync_type === 'debate_creation') {
          await processDebateCreation(op);
          
          await supabaseApi.updateSyncQueueItem(op.id, {
            status: 'completed',
            completed_at: new Date(),
          });
          
          results.succeeded++;
          
        } else if (op.sync_type === 'participant_join') {
          await processParticipantJoin(op);
          
          await supabaseApi.updateSyncQueueItem(op.id, {
            status: 'completed',
            completed_at: new Date(),
          });
          
          results.succeeded++;
          
        } else {
          logger.warn(LogCategory.SYNC, 'Unsupported sync type', {
            metadata: { syncType: op.sync_type, id: op.id }
          });
          
          await supabaseApi.updateSyncQueueItem(op.id, {
            status: 'failed',
            last_error: `Unsupported sync type: ${op.sync_type}`,
          });
          
          results.failed++;
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.error(
          LogCategory.SYNC,
          'Failed to process sync operation',
          error instanceof Error ? error : new Error(String(error)),
          {
            metadata: { 
              id: op.id,
              syncType: op.sync_type,
              attempts: op.attempts + 1
            }
          }
        );
        
        const newAttempts = op.attempts + 1;
        
        if (newAttempts >= op.max_attempts) {
          await supabaseApi.updateSyncQueueItem(op.id, {
            status: 'failed',
            attempts: newAttempts,
            last_error: errorMessage,
          });
          
          results.failed++;
          
        } else {
          const delayMinutes = Math.pow(2, newAttempts);
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
          
          await supabaseApi.updateSyncQueueItem(op.id, {
            status: 'pending',
            attempts: newAttempts,
            next_retry_at: nextRetryAt,
            last_error: errorMessage,
          });
          
          results.queued++;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(LogCategory.SYNC, 'Background sync job completed', {
      metadata: { ...results, duration }
    });
    
    return NextResponse.json({
      success: true,
      ...results,
      duration,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      LogCategory.SYNC,
      'Background sync job failed',
      error instanceof Error ? error : new Error(String(error)),
      { duration }
    );
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function processDebateCreation(op: any): Promise<void> {
  const { contract_address, payload } = op;
  const { topic, description, durationMinutes, creatorId } = payload;
  
  logger.info(LogCategory.SYNC, 'Processing debate creation from queue', {
    contractAddress: contract_address,
    metadata: { topic, attempt: op.attempts + 1 }
  });
  
  const existingDebate = await supabaseApi.getDebateByAddress(contract_address);
  if (existingDebate) {
    logger.info(LogCategory.SYNC, 'Debate already synced (from queue)', {
      contractAddress: contract_address,
      metadata: { debateId: existingDebate.id }
    });
    return;
  }
  
  const debateInfo = await genlayerClient.getDebateInfo(contract_address);
  
  const endTime = new Date(debateInfo.end_time * 1000);
  
  await supabaseApi.createDebate({
    contract_address,
    topic,
    description,
    duration_minutes: durationMinutes,
    end_time: endTime,
    status: debateInfo.status as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
    participant_count: 0,
    last_synced_at: new Date(),
  });
  
  logger.info(LogCategory.SYNC, 'Debate creation synced successfully (from queue)', {
    contractAddress: contract_address,
    metadata: { topic }
  });
}

async function processParticipantJoin(op: any): Promise<void> {
  const { contract_address, participant_address, payload } = op;
  const { argument, debate_id } = payload;
  
  logger.info(LogCategory.SYNC, 'Processing participant join from queue', {
    contractAddress: contract_address,
    metadata: { participantAddress: participant_address, attempt: op.attempts + 1 }
  });
  
  const hasJoined = await supabaseApi.hasUserJoined(debate_id, participant_address);
  if (hasJoined) {
    logger.info(LogCategory.SYNC, 'Participant already synced (from queue)', {
      contractAddress: contract_address,
      metadata: { participantAddress: participant_address }
    });
    return;
  }
  
  const participants = await genlayerClient.getParticipants(contract_address);
  const participantData = participants.find(
    p => p.address?.toLowerCase() === participant_address?.toLowerCase()
  );
  
  if (!participantData) {
    throw new Error(`Participant still not found on blockchain: ${participant_address}`);
  }
  
  const debate = await supabaseApi.getDebateByAddress(contract_address);
  if (!debate) {
    throw new Error(`Debate not found: ${contract_address}`);
  }
  
  const participant = await supabaseApi.createParticipant({
    debate_id: debate.id,
    contract_address: contract_address,
    participant_address: participant_address,
    joined_at: participantData.joined_at,
    has_submitted: true,
  });
  
  await supabaseApi.createArgument({
    debate_id: debate.id,
    contract_address: contract_address,
    author_address: participant_address,
    content: argument,
    timestamp: participantData.joined_at,
  });
  
  const newParticipantCount = debate.participant_count + 1;
  await supabaseApi.updateDebate(debate.id, {
    participant_count: newParticipantCount,
  });
  
  if (debate.status === 'OPEN' && newParticipantCount === 1) {
    await supabaseApi.updateDebate(debate.id, {
      status: 'ONGOING',
    });
  }
  
  logger.info(LogCategory.SYNC, 'Participant join synced successfully (from queue)', {
    contractAddress: contract_address,
    metadata: { 
      participantAddress: participant_address,
      participantCount: newParticipantCount
    }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
