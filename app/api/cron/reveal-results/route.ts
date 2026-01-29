/**
 * Cron Job: Reveal Results
 * 
 * Automatically reveals evaluation results when debates end.
 * Also syncs results to leaderboard_results table for display.
 * 
 * Flow:
 * 1. Find debates that have ended (end_time < now) and status = 'ONGOING'
 * 2. Check if all evaluations are complete for each debate
 * 3. If complete: reveal evaluations and update debate status to RESOLVED
 * 4. Sync to leaderboard_results table
 * 
 * Should be called every 1 minute by external cron service (cron-job.org)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, LogCategory } from '@/lib/logger';

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

export async function GET(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    const startTime = Date.now();
    const now = new Date().toISOString();

    logger.info(LogCategory.SYNC, 'Reveal results processor started', {
        metadata: { timestamp: now }
    });

    try {
        // Get initialized Supabase client
        const client = getSupabase();
        // Find debates that have ended but not yet resolved
        const { data: endedDebates, error: debatesError } = await client
            .from('debates')
            .select('id, contract_address, topic, participant_count')
            .eq('status', 'ENDED')
            .lt('end_time', now);

        if (debatesError) {
            throw new Error(`Failed to fetch ended debates: ${debatesError.message}`);
        }

        if (!endedDebates || endedDebates.length === 0) {
            logger.info(LogCategory.SYNC, 'No debates to reveal', {
                metadata: { duration: Date.now() - startTime }
            });
            return NextResponse.json({
                success: true,
                revealed: 0,
                message: 'No debates ready to reveal'
            });
        }

        logger.info(LogCategory.SYNC, 'Found ended debates to process', {
            metadata: { count: endedDebates.length }
        });

        const results = {
            revealed: 0,
            pending: 0,
            failed: 0,
        };

        for (const debate of endedDebates) {
            try {
                // Check if all evaluations are complete
                const { data: pendingQueue, error: queueError } = await client
                    .from('evaluation_queue')
                    .select('id')
                    .eq('debate_id', debate.id)
                    .in('status', ['pending', 'processing']);

                if (queueError) {
                    throw new Error(`Failed to check queue: ${queueError.message}`);
                }

                // If there are still pending evaluations, skip this debate
                if (pendingQueue && pendingQueue.length > 0) {
                    logger.info(LogCategory.SYNC, 'Debate has pending evaluations, skipping', {
                        contractAddress: debate.contract_address,
                        metadata: { pendingCount: pendingQueue.length }
                    });
                    results.pending++;
                    continue;
                }

                // Get all evaluations for this debate
                const { data: evaluations, error: evalError } = await client
                    .from('evaluations')
                    .select('*')
                    .eq('debate_id', debate.id)
                    .order('total_score', { ascending: false });

                if (evalError) {
                    throw new Error(`Failed to fetch evaluations: ${evalError.message}`);
                }

                // Check if we have any evaluations
                if (!evaluations || evaluations.length === 0) {
                    // No evaluations means no participants submitted
                    // Mark as resolved anyway but with no winner
                    await client
                        .from('debates')
                        .update({ status: 'RESOLVED' })
                        .eq('id', debate.id);

                    logger.info(LogCategory.SYNC, 'Debate resolved with no participants', {
                        contractAddress: debate.contract_address
                    });
                    results.revealed++;
                    continue;
                }

                // Reveal all evaluations (set is_visible = true)
                const { error: revealError } = await client
                    .from('evaluations')
                    .update({
                        is_visible: true,
                        revealed_at: now
                    })
                    .eq('debate_id', debate.id);

                if (revealError) {
                    throw new Error(`Failed to reveal evaluations: ${revealError.message}`);
                }

                // Sync to leaderboard_results table
                const winner = evaluations[0];  // Highest score (already sorted)

                for (let i = 0; i < evaluations.length; i++) {
                    const eval_item = evaluations[i];
                    const rank = i + 1;
                    const isWinner = rank === 1;

                    // Upsert to leaderboard_results
                    const { error: leaderboardError } = await client
                        .from('leaderboard_results')
                        .upsert({
                            debate_id: debate.id,
                            contract_address: debate.contract_address,
                            participant_address: eval_item.participant_address,
                            score: eval_item.total_score,
                            reasoning: eval_item.reasoning,
                            rank: rank,
                            is_winner: isWinner,
                            logic_reasoning: eval_item.logic_reasoning,
                            evidence_facts: eval_item.evidence_facts,
                            clarity: eval_item.clarity,
                            relevance: eval_item.relevance,
                            originality: eval_item.originality,
                            persuasiveness: eval_item.persuasiveness,
                        }, {
                            onConflict: 'debate_id,participant_address'
                        });

                    if (leaderboardError) {
                        logger.error(
                            LogCategory.SYNC,
                            'Failed to sync leaderboard entry',
                            new Error(leaderboardError.message),
                            { metadata: { participantAddress: eval_item.participant_address } }
                        );
                    }
                }

                // Update debate status to RESOLVED
                const { error: statusError } = await client
                    .from('debates')
                    .update({ status: 'RESOLVED' })
                    .eq('id', debate.id);

                if (statusError) {
                    throw new Error(`Failed to update debate status: ${statusError.message}`);
                }

                logger.info(LogCategory.SYNC, 'Debate results revealed successfully', {
                    contractAddress: debate.contract_address,
                    metadata: {
                        participantCount: evaluations.length,
                        winner: winner.participant_address,
                        winnerScore: winner.total_score
                    }
                });

                results.revealed++;

            } catch (error) {
                logger.error(
                    LogCategory.SYNC,
                    'Failed to reveal debate results',
                    error instanceof Error ? error : new Error(String(error)),
                    { metadata: { debateId: debate.id } }
                );
                results.failed++;
            }
        }

        const duration = Date.now() - startTime;
        logger.info(LogCategory.SYNC, 'Reveal results processor completed', {
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
            'Reveal results processor failed',
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
