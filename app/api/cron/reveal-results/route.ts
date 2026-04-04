import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

export async function GET(request: NextRequest) {
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
        const client = getSupabase();

        const { data: expiredDebates, error: expiredError } = await client
            .from('debates')
            .select('id, contract_address, status')
            .in('status', ['ONGOING', 'OPEN'])
            .lt('end_time', now);

        if (expiredError) {
            logger.error(LogCategory.SYNC, 'Failed to fetch expired debates', 
                new Error(expiredError.message));
        } else if (expiredDebates && expiredDebates.length > 0) {
            logger.info(LogCategory.SYNC, 'Found expired debates to transition to ENDED', {
                metadata: { count: expiredDebates.length }
            });

            for (const debate of expiredDebates) {
                const { error: updateError } = await client
                    .from('debates')
                    .update({ status: 'ENDED' })
                    .eq('id', debate.id);

                if (updateError) {
                    logger.error(LogCategory.SYNC, 'Failed to update expired debate status',
                        new Error(updateError.message),
                        { metadata: { debateId: debate.id } }
                    );
                } else {
                    logger.info(LogCategory.SYNC, 'Debate status auto-transitioned to ENDED', {
                        contractAddress: debate.contract_address,
                        metadata: { previousStatus: debate.status }
                    });
                }
            }
        }

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
                metadata: { 
                    duration: Date.now() - startTime,
                    expiredTransitioned: expiredDebates?.length || 0
                }
            });
            return NextResponse.json({
                success: true,
                revealed: 0,
                transitioned: expiredDebates?.length || 0,
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
                const { data: pendingQueue, error: queueError } = await client
                    .from('evaluation_queue')
                    .select('id')
                    .eq('debate_id', debate.id)
                    .in('status', ['pending', 'processing']);

                if (queueError) {
                    throw new Error(`Failed to check queue: ${queueError.message}`);
                }

                if (pendingQueue && pendingQueue.length > 0) {
                    logger.info(LogCategory.SYNC, 'Debate has pending evaluations, skipping', {
                        contractAddress: debate.contract_address,
                        metadata: { pendingCount: pendingQueue.length }
                    });
                    results.pending++;
                    continue;
                }

                const { data: evaluations, error: evalError } = await client
                    .from('evaluations')
                    .select('*')
                    .eq('debate_id', debate.id)
                    .order('total_score', { ascending: false });

                if (evalError) {
                    throw new Error(`Failed to fetch evaluations: ${evalError.message}`);
                }

                if (!evaluations || evaluations.length === 0) {
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

                const winner = evaluations[0];

                for (let i = 0; i < evaluations.length; i++) {
                    const eval_item = evaluations[i];
                    const rank = i + 1;
                    const isWinner = rank === 1;

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
            transitioned: expiredDebates?.length || 0,
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

export async function POST(request: NextRequest) {
    return GET(request);
}
