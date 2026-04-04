import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as genlayerClient from '@/lib/genlayer-client';
import { logger, LogCategory } from '@/lib/logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';

    if (!authHeader) {
        return false;
    }

    const token = authHeader.replace('Bearer ', '');
    return token === cronSecret;
}

const MAX_ITEMS_PER_RUN = 5;
const MAX_ITEMS_PER_DEBATE = 2;

export async function GET(request: NextRequest) {
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
        const client = getSupabase();

        const { data: pendingItems, error: fetchError } = await client
            .from('evaluation_queue')
            .select('*')
            .eq('status', 'pending')
            .order('priority', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(MAX_ITEMS_PER_RUN * 2);

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

        for (const item of itemsToProcess) {
            results.processed++;

            try {
                await client
                    .from('evaluation_queue')
                    .update({
                        status: 'processing',
                        processing_started_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                logger.info(LogCategory.SYNC, 'Evaluating argument with GenLayer AI', {
                    contractAddress: item.contract_address,
                    metadata: { participantAddress: item.participant_address }
                });

                const evaluation = await genlayerClient.evaluateSingleArgument(
                    item.contract_address,
                    item.participant_address,
                    item.argument_content
                );

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
                        is_visible: false,
                    }, {
                        onConflict: 'debate_id,participant_address'
                    });

                if (insertError) {
                    throw new Error(`Failed to save evaluation: ${insertError.message}`);
                }

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

export async function POST(request: NextRequest) {
    return GET(request);
}
