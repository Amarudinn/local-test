/**
 * Cron Job: Process Evaluation Queue
 * 
 * Processes pending argument evaluations from the evaluation_queue table.
 * Uses GenLayer AI to evaluate each argument individually.
 * 
 * Flow:
 * 1. Fetch pending items from evaluation_queue (grouped by debate for fairness)
 * 2. For each item, call GenLayer evaluate_single_argument
 * 3. Save result to evaluations table (is_visible: false)
 * 4. Mark queue item as completed
 * 
 * Should be called every 1 minute by external cron service (cron-job.org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as genlayerClient from '@/lib/genlayer-client';
import { logger, LogCategory } from '@/lib/logger';

// Vercel serverless function config - 5 minute timeout for GenLayer AI evaluation
export const maxDuration = 300; // 5 minutes in seconds
export const dynamic = 'force-dynamic';

// Lazy-initialize Supabase client (avoid build-time errors)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (!supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration is missing');
        }

        supabase = createClient(supabaseUrl, supabaseKey);
    }
    return supabase;
}

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';

    if (!authHeader) {
        return false;
    }

    const token = authHeader.replace('Bearer ', '');
    return token === cronSecret;
}

// Configuration
const MAX_ITEMS_PER_RUN = 5;  // Process up to 5 items per cron run
const MAX_ITEMS_PER_DEBATE = 2;  // Max 2 items per debate per run (fairness)

export async function GET(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    const startTime = Date.now();
    logger.info(LogCategory.SYNC, 'Evaluation queue processor started', {
        metadata: { timestamp: new Date().toISOString() }
    });

    try {
        // Get initialized Supabase client
        const client = getSupabase();

        // Get pending items grouped by debate (for fair processing)
        const { data: pendingItems, error: fetchError } = await client
            .from('evaluation_queue')
            .select('*')
            .eq('status', 'pending')
            .order('priority', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(MAX_ITEMS_PER_RUN * 2);  // Fetch extra to allow per-debate limiting

        if (fetchError) {
            throw new Error(`Failed to fetch queue: ${fetchError.message}`);
        }

        if (!pendingItems || pendingItems.length === 0) {
            logger.info(LogCategory.SYNC, 'No pending evaluations in queue', {
                metadata: { duration: Date.now() - startTime }
            });
            return NextResponse.json({
                success: true,
                processed: 0,
                message: 'No pending evaluations'
            });
        }

        // Group by debate and limit per debate for fairness
        const debateItemCount: Record<string, number> = {};
        const itemsToProcess: typeof pendingItems = [];

        for (const item of pendingItems) {
            const debateId = item.debate_id;
            debateItemCount[debateId] = (debateItemCount[debateId] || 0) + 1;

            if (debateItemCount[debateId] <= MAX_ITEMS_PER_DEBATE &&
                itemsToProcess.length < MAX_ITEMS_PER_RUN) {
                itemsToProcess.push(item);
            }
        }

        logger.info(LogCategory.SYNC, 'Processing evaluation queue items', {
            metadata: {
                totalPending: pendingItems.length,
                toProcess: itemsToProcess.length,
                debates: Object.keys(debateItemCount).length
            }
        });

        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
        };

        // Process each item
        for (const item of itemsToProcess) {
            results.processed++;

            try {
                // Mark as processing
                await client
                    .from('evaluation_queue')
                    .update({
                        status: 'processing',
                        processing_started_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                // Call GenLayer AI to evaluate the argument
                logger.info(LogCategory.SYNC, 'Evaluating argument with GenLayer AI', {
                    contractAddress: item.contract_address,
                    metadata: { participantAddress: item.participant_address }
                });

                const evaluation = await genlayerClient.evaluateSingleArgument(
                    item.contract_address,
                    item.participant_address,
                    item.argument_content
                );

                // Save evaluation result to database (hidden until debate ends)
                const { error: insertError } = await client
                    .from('evaluations')
                    .upsert({
                        debate_id: item.debate_id,
                        contract_address: item.contract_address,
                        participant_address: item.participant_address,
                        total_score: evaluation.total_score,
                        logic_reasoning: evaluation.logic_reasoning,
                        evidence_facts: evaluation.evidence_facts,
                        clarity: evaluation.clarity,
                        relevance: evaluation.relevance,
                        originality: evaluation.originality,
                        persuasiveness: evaluation.persuasiveness,
                        reasoning: evaluation.reasoning,
                        is_visible: false,  // Hidden until debate ends
                    }, {
                        onConflict: 'debate_id,participant_address'
                    });

                if (insertError) {
                    throw new Error(`Failed to save evaluation: ${insertError.message}`);
                }

                // Mark queue item as completed
                await client
                    .from('evaluation_queue')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                logger.info(LogCategory.SYNC, 'Evaluation completed successfully', {
                    contractAddress: item.contract_address,
                    metadata: {
                        participantAddress: item.participant_address,
                        score: evaluation.total_score
                    }
                });

                results.succeeded++;

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                logger.error(
                    LogCategory.SYNC,
                    'Failed to evaluate argument',
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        metadata: {
                            id: item.id,
                            attempts: item.attempts + 1
                        }
                    }
                );

                // Increment attempts
                const newAttempts = item.attempts + 1;
                const newStatus = newAttempts >= item.max_attempts ? 'failed' : 'pending';

                await client
                    .from('evaluation_queue')
                    .update({
                        status: newStatus,
                        attempts: newAttempts,
                        last_error: errorMessage,
                        processing_started_at: null
                    })
                    .eq('id', item.id);

                results.failed++;
            }
        }

        const duration = Date.now() - startTime;
        logger.info(LogCategory.SYNC, 'Evaluation queue processor completed', {
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
            'Evaluation queue processor failed',
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

// Allow POST for manual testing
export async function POST(request: NextRequest) {
    return GET(request);
}
