/**
 * VPS Direct Processor for Ruang Debat
 * 
 * This script runs DIRECTLY on VPS, processing evaluations without
 * going through Vercel. It connects directly to:
 * - Supabase (database)
 * - GenLayer (blockchain/AI)
 * 
 * No timeout limits!
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createGenLayerClient, createAccount } from 'genlayer-js';
import dotenv from 'dotenv';

dotenv.config();

// Define studionet chain manually (avoiding subpath export issues)
const studionet = {
    id: 'studionet',
    name: 'GenLayer Studionet',
};

// ============== Configuration ==============
const CONFIG = {
    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || '',

    // GenLayer
    GENLAYER_RPC_URL: process.env.GENLAYER_RPC_URL || 'https://studio.genlayer.com/api',
    GENLAYER_PRIVATE_KEY: process.env.GENLAYER_PRIVATE_KEY || '',

    // Processing intervals
    EVALUATION_INTERVAL: 60 * 1000,  // 1 minute
    REVEAL_INTERVAL: 60 * 1000,      // 1 minute

    // Max items per run
    MAX_EVALUATIONS_PER_RUN: 5,
};

// ============== Clients ==============
let supabase = null;
let genlayerClient = null;
let genlayerServerClient = null;

function initClients() {
    // Supabase
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
        throw new Error('SUPABASE_URL and SUPABASE_KEY are required');
    }
    supabase = createSupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // GenLayer (read-only)
    genlayerClient = createGenLayerClient({
        chain: studionet,
        endpoint: CONFIG.GENLAYER_RPC_URL,
    });

    // GenLayer (with account for write operations)
    if (CONFIG.GENLAYER_PRIVATE_KEY) {
        const account = createAccount(CONFIG.GENLAYER_PRIVATE_KEY);
        genlayerServerClient = createGenLayerClient({
            chain: studionet,
            endpoint: CONFIG.GENLAYER_RPC_URL,
            account,
        });
    }

    log('info', 'Clients initialized');
}

// ============== Logging ==============
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        level,
        message,
        ...data
    }));
}

// ============== Evaluation Processing ==============
async function processEvaluationQueue() {
    log('info', '📋 Processing evaluation queue...');

    try {
        // 1. Fetch pending items
        const { data: pendingItems, error } = await supabase
            .from('evaluation_queue')
            .select('*')
            .eq('status', 'pending')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(CONFIG.MAX_EVALUATIONS_PER_RUN);

        if (error) {
            log('error', 'Failed to fetch pending items', { error: error.message });
            return;
        }

        if (!pendingItems || pendingItems.length === 0) {
            log('info', 'No pending evaluations');
            return;
        }

        log('info', `Found ${pendingItems.length} pending evaluations`);

        // 2. Process each item
        for (const item of pendingItems) {
            await processEvaluationItem(item);
        }

        log('info', `✅ Processed ${pendingItems.length} evaluations`);

    } catch (err) {
        log('error', 'Evaluation queue processing failed', { error: err.message });
    }
}

async function processEvaluationItem(item) {
    log('info', `Processing evaluation for ${item.participant_address}`, {
        debateId: item.debate_id,
        contractAddress: item.contract_address,
    });

    try {
        // Mark as processing
        await supabase
            .from('evaluation_queue')
            .update({
                status: 'processing',
                processing_started_at: new Date().toISOString(),
                attempts: item.attempts + 1,
            })
            .eq('id', item.id);

        // Call GenLayer smart contract to evaluate
        const evaluation = await evaluateSingleArgument(
            item.contract_address,
            item.participant_address,
            item.argument_content
        );

        // Save evaluation to database
        const { error: insertError } = await supabase
            .from('evaluations')
            .upsert({
                debate_id: item.debate_id,
                contract_address: item.contract_address,
                participant_address: item.participant_address,
                argument_content: item.argument_content,
                total_score: evaluation.total_score,
                logic_reasoning: evaluation.logic_reasoning,
                evidence_facts: evaluation.evidence_facts,
                clarity: evaluation.clarity,
                relevance: evaluation.relevance,
                originality: evaluation.originality,
                persuasiveness: evaluation.persuasiveness,
                reasoning: evaluation.reasoning,
                is_visible: false,
                evaluated_at: new Date().toISOString(),
            }, {
                onConflict: 'debate_id,participant_address',
            });

        if (insertError) {
            throw new Error(`Failed to save evaluation: ${insertError.message}`);
        }

        // Mark queue item as completed
        await supabase
            .from('evaluation_queue')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                last_error: null,
            })
            .eq('id', item.id);

        log('info', `✅ Evaluation completed`, {
            participant: item.participant_address,
            score: evaluation.total_score,
        });

    } catch (err) {
        log('error', `❌ Evaluation failed for ${item.participant_address}`, {
            error: err.message,
        });

        // Update with error
        const newStatus = item.attempts + 1 >= 3 ? 'failed' : 'pending';
        await supabase
            .from('evaluation_queue')
            .update({
                status: newStatus,
                last_error: err.message,
                processing_started_at: null,
            })
            .eq('id', item.id);
    }
}

// ============== GenLayer Integration ==============
async function evaluateSingleArgument(contractAddress, participantAddress, argumentContent) {
    log('info', 'Calling GenLayer evaluate_single_argument...', { contractAddress });

    if (!genlayerServerClient) {
        throw new Error('GenLayer server client not initialized (missing GENLAYER_PRIVATE_KEY)');
    }

    // Initialize consensus
    await genlayerServerClient.initializeConsensusSmartContract?.();

    // Call writeContract to trigger AI evaluation
    const txHash = await genlayerServerClient.writeContract({
        address: contractAddress,
        functionName: 'evaluate_single_argument',
        args: [participantAddress, argumentContent],
        value: BigInt(0),
    });

    log('info', 'Transaction submitted', { txHash: String(txHash) });

    // Wait for confirmation
    const receipt = await genlayerServerClient.waitForTransactionReceipt?.({
        hash: txHash,
        status: 'ACCEPTED',
        retries: 60,  // More retries for long AI evaluation
        interval: 5000,  // 5 second intervals
    });

    log('info', 'Transaction confirmed', { status: receipt?.status });

    // Read the stored evaluation
    const storedEvaluation = await genlayerClient.readContract({
        address: contractAddress,
        functionName: 'get_pending_evaluation',
        args: [participantAddress],
    });

    // Parse the result
    let evaluationData;
    if (storedEvaluation instanceof Map) {
        evaluationData = {
            found: storedEvaluation.get('found'),
            total_score: Number(storedEvaluation.get('total_score')) || 0,
            logic_reasoning: Number(storedEvaluation.get('logic_reasoning')) || 0,
            evidence_facts: Number(storedEvaluation.get('evidence_facts')) || 0,
            clarity: Number(storedEvaluation.get('clarity')) || 0,
            relevance: Number(storedEvaluation.get('relevance')) || 0,
            originality: Number(storedEvaluation.get('originality')) || 0,
            persuasiveness: Number(storedEvaluation.get('persuasiveness')) || 0,
            reasoning: storedEvaluation.get('reasoning') || '',
        };
    } else {
        evaluationData = storedEvaluation || {};
    }

    if (!evaluationData.found) {
        throw new Error('Evaluation not found in contract storage');
    }

    log('info', 'Evaluation retrieved', {
        totalScore: evaluationData.total_score,
        reasoning: evaluationData.reasoning?.substring(0, 100),
    });

    return evaluationData;
}

// ============== Reveal Results ==============
async function revealResults() {
    log('info', '🎯 Checking for debates to reveal...');

    try {
        const now = new Date().toISOString();

        // Find ended debates
        const { data: endedDebates, error } = await supabase
            .from('debates')
            .select('*')
            .eq('status', 'ENDED')
            .lt('end_time', now);

        if (error) {
            log('error', 'Failed to fetch ended debates', { error: error.message });
            return;
        }

        if (!endedDebates || endedDebates.length === 0) {
            log('info', 'No debates to reveal');
            return;
        }

        for (const debate of endedDebates) {
            await revealDebateResults(debate);
        }

    } catch (err) {
        log('error', 'Reveal results failed', { error: err.message });
    }
}

async function revealDebateResults(debate) {
    log('info', `Revealing results for debate: ${debate.topic}`);

    try {
        // Check if all evaluations are complete
        const { data: queueItems } = await supabase
            .from('evaluation_queue')
            .select('status')
            .eq('debate_id', debate.id);

        const pendingCount = queueItems?.filter(i => i.status !== 'completed').length || 0;

        if (pendingCount > 0) {
            log('info', `Debate ${debate.id} has ${pendingCount} pending evaluations, skipping reveal`);
            return;
        }

        // Reveal evaluations (set is_visible = true)
        await supabase
            .from('evaluations')
            .update({ is_visible: true })
            .eq('debate_id', debate.id);

        // Update debate status to RESOLVED
        await supabase
            .from('debates')
            .update({ status: 'RESOLVED' })
            .eq('id', debate.id);

        // Sync to leaderboard_results
        const { data: evaluations } = await supabase
            .from('evaluations')
            .select('*')
            .eq('debate_id', debate.id);

        if (evaluations && evaluations.length > 0) {
            // Find winner
            const sorted = [...evaluations].sort((a, b) => b.total_score - a.total_score);
            const winner = sorted[0];

            // Insert leaderboard results
            for (const evaluation of evaluations) {
                await supabase
                    .from('leaderboard_results')
                    .upsert({
                        debate_id: debate.id,
                        contract_address: debate.contract_address,
                        participant_address: evaluation.participant_address,
                        total_score: evaluation.total_score,
                        logic_reasoning: evaluation.logic_reasoning,
                        evidence_facts: evaluation.evidence_facts,
                        clarity: evaluation.clarity,
                        relevance: evaluation.relevance,
                        originality: evaluation.originality,
                        persuasiveness: evaluation.persuasiveness,
                        reasoning: evaluation.reasoning,
                        is_winner: evaluation.participant_address === winner.participant_address,
                    }, {
                        onConflict: 'debate_id,participant_address',
                    });
            }
        }

        log('info', `✅ Debate revealed: ${debate.topic}`);

    } catch (err) {
        log('error', `Failed to reveal debate ${debate.id}`, { error: err.message });
    }
}

// ============== Main Loop ==============
let evaluationRunning = false;
let revealRunning = false;

async function runEvaluationLoop() {
    if (evaluationRunning) {
        log('warn', 'Evaluation loop already running, skipping');
        return;
    }

    evaluationRunning = true;
    try {
        await processEvaluationQueue();
    } finally {
        evaluationRunning = false;
    }
}

async function runRevealLoop() {
    if (revealRunning) {
        log('warn', 'Reveal loop already running, skipping');
        return;
    }

    revealRunning = true;
    try {
        await revealResults();
    } finally {
        revealRunning = false;
    }
}

// ============== Start ==============
function start() {
    log('info', '🚀 VPS Direct Processor starting');

    // Validate config
    const missing = [];
    if (!CONFIG.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!CONFIG.SUPABASE_KEY) missing.push('SUPABASE_KEY');
    if (!CONFIG.GENLAYER_PRIVATE_KEY) missing.push('GENLAYER_PRIVATE_KEY');

    if (missing.length > 0) {
        log('error', `❌ Missing required environment variables: ${missing.join(', ')}`);
        log('info', 'Please update your .env file');
        process.exit(1);
    }

    // Initialize clients
    initClients();

    // Run immediately
    runEvaluationLoop();

    // Then run on intervals
    setInterval(runEvaluationLoop, CONFIG.EVALUATION_INTERVAL);
    setInterval(runRevealLoop, CONFIG.REVEAL_INTERVAL);

    log('info', '✅ Direct processor is running. Press Ctrl+C to stop.');
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('info', '👋 Shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', '👋 Shutting down...');
    process.exit(0);
});

// Start
start();
