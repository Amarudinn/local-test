/**
 * VPS Cron Worker for Ruang Debat
 * 
 * This script runs on your VPS and calls the cron job endpoints
 * with proper timeout handling (5+ minutes for GenLayer AI evaluation).
 * 
 * Setup:
 * 1. Copy this folder to your VPS
 * 2. Run: npm install
 * 3. Create .env file with your secrets
 * 4. Run: npm start (or use PM2 for production)
 */

const fetch = require('node-fetch');
require('dotenv').config();

// Configuration from environment
const CONFIG = {
    BASE_URL: process.env.API_BASE_URL || 'https://local-test-three.vercel.app',
    CRON_SECRET: process.env.CRON_SECRET || '',

    // Intervals in milliseconds
    EVALUATION_INTERVAL: 60 * 1000,  // 1 minute
    REVEAL_INTERVAL: 60 * 1000,      // 1 minute

    // Timeout for requests (5 minutes)
    REQUEST_TIMEOUT: 5 * 60 * 1000,
};

// Logging helper
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        level,
        message,
        ...data
    }));
}

// Call API with timeout
async function callEndpoint(endpoint, name) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    try {
        log('info', `Starting ${name}`, { endpoint });

        const startTime = Date.now();
        const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.CRON_SECRET}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });

        const duration = Date.now() - startTime;
        const data = await response.json();

        if (response.ok) {
            log('info', `${name} completed`, {
                status: response.status,
                duration: `${duration}ms`,
                result: data
            });
        } else {
            log('error', `${name} failed`, {
                status: response.status,
                duration: `${duration}ms`,
                error: data
            });
        }

        return { success: response.ok, data };

    } catch (error) {
        if (error.name === 'AbortError') {
            log('error', `${name} timed out after ${CONFIG.REQUEST_TIMEOUT}ms`);
        } else {
            log('error', `${name} error`, { error: error.message });
        }
        return { success: false, error: error.message };

    } finally {
        clearTimeout(timeoutId);
    }
}

// Process evaluation queue
async function processEvaluationQueue() {
    return callEndpoint('/api/cron/process-evaluation-queue', 'Process Evaluation Queue');
}

// Reveal results
async function revealResults() {
    return callEndpoint('/api/cron/reveal-results', 'Reveal Results');
}

// Main loop
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

// Start the cron worker
function start() {
    log('info', '🚀 VPS Cron Worker starting', {
        baseUrl: CONFIG.BASE_URL,
        evaluationInterval: `${CONFIG.EVALUATION_INTERVAL / 1000}s`,
        revealInterval: `${CONFIG.REVEAL_INTERVAL / 1000}s`,
        requestTimeout: `${CONFIG.REQUEST_TIMEOUT / 1000}s`,
    });

    if (!CONFIG.CRON_SECRET) {
        log('error', '❌ CRON_SECRET not set! Please create .env file');
        process.exit(1);
    }

    // Run immediately on start
    runEvaluationLoop();

    // Then run on intervals
    setInterval(runEvaluationLoop, CONFIG.EVALUATION_INTERVAL);
    setInterval(runRevealLoop, CONFIG.REVEAL_INTERVAL);

    log('info', '✅ Cron worker is running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('info', '👋 Shutting down cron worker...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', '👋 Shutting down cron worker...');
    process.exit(0);
});

// Start
start();
