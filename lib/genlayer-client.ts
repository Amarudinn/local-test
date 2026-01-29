/**
 * GenLayer blockchain client configuration
 * Provides typed interface for interacting with GenLayer smart contracts
 */

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { logger, LogCategory, logBlockchain } from "./logger";

// Extract endpoint resolution to avoid duplication
const resolveEndpoint = () =>
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";

// Default client instance for read-only operations
let defaultClient = createClient({
  chain: studionet,
  endpoint: resolveEndpoint()
});

// Server-side client with private key for write operations (cron jobs)
let serverClient: ReturnType<typeof createClient> | null = null;

/**
 * Get the default GenLayer client instance (read-only)
 * For write operations, use the client from useGenLayerSigner hook
 */
export function getClient() {
  return defaultClient;
}

/**
 * Get server-side GenLayer client with private key for write operations
 * Used by cron jobs and server-side functions that need to sign transactions
 */
export function getServerClient() {
  if (!serverClient) {
    const privateKey = process.env.GENLAYER_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('GENLAYER_PRIVATE_KEY environment variable is not set. Required for server-side write operations.');
    }

    // Create account from private key
    const account = createAccount(privateKey as `0x${string}`);

    // Create client with account for write operations
    serverClient = createClient({
      chain: studionet,
      endpoint: resolveEndpoint(),
      account: account
    });

    logger.info(LogCategory.BLOCKCHAIN, 'Server-side GenLayer client initialized', {
      metadata: { accountAddress: account.address }
    });
  }

  return serverClient;
}

/**
 * Deploy a new DebateRoom contract to the GenLayer network
 * 
 * @param client - GenLayer client with signer attached (from useGenLayerSigner hook)
 * @param topic - Debate title (1-200 characters)
 * @param description - Detailed explanation (1-1000 characters)
 * @param durationMinutes - Debate duration in minutes (must be positive integer)
 * @returns Contract address and transaction hash
 * @throws Error if deployment fails or validation fails
 */
export async function deployDebateContract(
  client: any,
  topic: string,
  description: string,
  durationMinutes: number
): Promise<{ contractAddress: string; transactionHash: string }> {
  // Client-side validation
  if (!topic || topic.length === 0 || topic.length > 200) {
    throw new Error("Topic must be between 1 and 200 characters");
  }

  if (!description || description.length === 0 || description.length > 1000) {
    throw new Error("Description must be between 1 and 1000 characters");
  }

  if (durationMinutes <= 0 || !Number.isInteger(durationMinutes)) {
    throw new Error("Duration must be a positive integer (in minutes)");
  }

  logger.info(LogCategory.BLOCKCHAIN, "Deploying DebateRoom contract", {
    metadata: { topic, durationMinutes }
  });

  try {
    // Ensure consensus smart contract is initialized
    await client.initializeConsensusSmartContract();

    // Read the contract code from the contracts directory
    // Note: In production, this should be bundled or fetched from a reliable source
    const contractCode = await fetch('/contracts/debate_room.py').then(res => res.text());

    // Deploy the contract with duration in minutes (integer)
    const transactionHash = await client.deployContract({
      code: contractCode,
      args: [topic, description, durationMinutes],
    });

    logger.info(LogCategory.BLOCKCHAIN, "Contract deployment transaction submitted", {
      contractAddress: undefined,
      metadata: { transactionHash, topic }
    });

    // Wait for deployment to complete and get contract address from receipt
    const receipt = await client.waitForTransactionReceipt({
      hash: transactionHash as any,
      status: TransactionStatus.ACCEPTED,
      retries: 50,
      interval: 5000,
    });

    const contractAddress = receipt.data?.contract_address as string;

    if (!contractAddress) {
      throw new Error('Contract address not found in receipt');
    }

    logger.info(LogCategory.BLOCKCHAIN, "DebateRoom contract deployed successfully", {
      contractAddress,
      metadata: { transactionHash, topic }
    });

    return {
      contractAddress,
      transactionHash,
    };
  } catch (error) {
    logBlockchain.error(
      "Failed to deploy DebateRoom contract",
      error instanceof Error ? error : new Error(String(error)),
      undefined
    );

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient funds to deploy contract");
      }
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was cancelled");
      }
      if (error.message.includes("timeout")) {
        throw new Error("Transaction is taking longer than expected. Please check your wallet");
      }
    }

    throw new Error(`Failed to deploy contract: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// WRITE METHODS - Require wallet signature and gas
// ============================================================================

/**
 * Join a debate and submit an argument
 * 
 * @param client - GenLayer client with signer attached (from useGenLayerSigner hook)
 * @param contractAddress - The debate contract address
 * @param argument - The participant's argument (1-500 characters)
 * @returns Transaction hash and result
 * @throws Error if validation fails or transaction fails
 */
export async function joinDebate(
  client: any,
  contractAddress: string,
  argument: string
): Promise<{ transactionHash: string; result: any }> {
  // Client-side validation
  if (!argument || argument.length === 0 || argument.length > 500) {
    throw new Error("Argument must be between 1 and 500 characters");
  }

  logger.info(LogCategory.BLOCKCHAIN, "Joining debate", {
    contractAddress,
    metadata: { argumentLength: argument.length }
  });

  try {
    // Ensure consensus smart contract is initialized
    await client.initializeConsensusSmartContract();

    // Get current timestamp in seconds (Unix timestamp)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const transactionHash = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName: "join_debate",
      args: [argument, currentTimestamp],
      value: BigInt(0),
    });

    logger.info(LogCategory.BLOCKCHAIN, "Join debate transaction submitted", {
      contractAddress,
      metadata: { transactionHash }
    });

    // Wait for transaction to be confirmed
    const receipt = await client.waitForTransactionReceipt({
      hash: transactionHash as any,
      status: TransactionStatus.ACCEPTED,
      retries: 50,
      interval: 5000,
    });

    logger.info(LogCategory.BLOCKCHAIN, "Successfully joined debate", {
      contractAddress,
      metadata: { transactionHash, status: receipt.status }
    });

    return {
      transactionHash,
      result: receipt,
    };
  } catch (error) {
    logBlockchain.error(
      "Failed to join debate",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("already submitted")) {
        throw new Error("You have already submitted an argument to this debate");
      }
      if (error.message.includes("ended")) {
        throw new Error("This debate has ended and is no longer accepting arguments");
      }
      if (error.message.includes("resolved")) {
        throw new Error("This debate has been resolved and is no longer accepting arguments");
      }
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was cancelled");
      }
      if (error.message.includes("timeout")) {
        throw new Error("Transaction is taking longer than expected. Please check your wallet");
      }
    }

    throw new Error(`Failed to join debate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resolve a debate using AI judging
 * 
 * @param client - GenLayer client with signer attached (from useGenLayerSigner hook)
 * @param contractAddress - The debate contract address
 * @returns Transaction hash and resolution results
 * @throws Error if debate hasn't ended or transaction fails
 */
export async function resolveDebate(
  client: any,
  contractAddress: string
): Promise<{ transactionHash: string; result: any }> {
  logger.info(LogCategory.BLOCKCHAIN, "Resolving debate", { contractAddress });

  try {
    // Ensure consensus smart contract is initialized
    await client.initializeConsensusSmartContract();

    // Get current timestamp in seconds (Unix timestamp)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const transactionHash = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName: "resolve_debate",
      args: [currentTimestamp],
      value: BigInt(0),
    });

    logger.info(LogCategory.BLOCKCHAIN, "Resolve debate transaction submitted", {
      contractAddress,
      metadata: { transactionHash }
    });

    // Wait for transaction to be confirmed
    const receipt = await client.waitForTransactionReceipt({
      hash: transactionHash as any,
      status: TransactionStatus.ACCEPTED,
      retries: 50,
      interval: 5000,
    });

    logger.info(LogCategory.BLOCKCHAIN, "Successfully resolved debate", {
      contractAddress,
      metadata: { transactionHash, status: receipt.status }
    });

    return {
      transactionHash,
      result: receipt,
    };
  } catch (error) {
    logBlockchain.error(
      "Failed to resolve debate",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("not ended yet")) {
        throw new Error("This debate has not ended yet. Please wait until the end time");
      }
      if (error.message.includes("already been resolved")) {
        throw new Error("This debate has already been resolved");
      }
      if (error.message.includes("no participants")) {
        throw new Error("Cannot resolve debate with no participants");
      }
      if (error.message.includes("user rejected")) {
        throw new Error("Transaction was cancelled");
      }
      if (error.message.includes("timeout")) {
        throw new Error("Transaction is taking longer than expected. Please check your wallet");
      }
    }

    throw new Error(`Failed to resolve debate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// VIEW METHODS - Read-only, no gas required
// ============================================================================

/**
 * Get debate metadata and current state
 * 
 * @param contractAddress - The debate contract address
 * @returns Debate information object
 */
export async function getDebateInfo(contractAddress: string): Promise<{
  topic: string;
  description: string;
  creator: string;
  created_at: number;
  duration_seconds: number;
  end_time: number;
  status: 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED';
  participant_count: number;
}> {
  logger.debug(LogCategory.BLOCKCHAIN, "Fetching debate info", { contractAddress });

  try {
    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "get_debate_info",
      args: [],
    });

    // GenLayer returns dictionaries as JavaScript Map objects
    // Convert Map to plain object
    if (result instanceof Map) {
      return {
        topic: result.get('topic') as string,
        description: result.get('description') as string,
        creator: result.get('creator') as string,
        created_at: Number(result.get('created_at')),
        duration_seconds: Number(result.get('duration_seconds')),
        end_time: Number(result.get('end_time')),
        status: result.get('status') as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
        participant_count: Number(result.get('participant_count')),
      };
    }

    return result as any;
  } catch (error) {
    logBlockchain.error(
      "Failed to fetch debate info",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );
    throw new Error(`Failed to fetch debate info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get list of all participants in a debate
 * 
 * @param contractAddress - The debate contract address
 * @returns Array of participant objects
 */
export async function getParticipants(contractAddress: string): Promise<Array<{
  address: string;
  joined_at: number;
  has_submitted: boolean;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, "Fetching participants", { contractAddress });

  try {
    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "get_participants",
      args: [],
    });

    // GenLayer may return Python lists as arrays or other structures
    // Convert to plain array if needed
    if (Array.isArray(result)) {
      return result.map((p: any) => {
        // If participant is a Map, convert to plain object
        if (p instanceof Map) {
          return {
            address: p.get('address') as string,
            joined_at: Number(p.get('joined_at')),
            has_submitted: p.get('has_submitted') as boolean,
          };
        }
        return p;
      });
    }

    return result as any;
  } catch (error) {
    logBlockchain.error(
      "Failed to fetch participants",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );
    throw new Error(`Failed to fetch participants: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all arguments in chronological order
 * 
 * @param contractAddress - The debate contract address
 * @returns Array of argument objects
 */
export async function getArguments(contractAddress: string): Promise<Array<{
  author: string;
  content: string;
  timestamp: number;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, "Fetching arguments", { contractAddress });

  try {
    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "get_arguments",
      args: [],
    });

    // GenLayer may return Python lists as arrays or other structures
    // Convert to plain array if needed
    if (Array.isArray(result)) {
      return result.map((arg: any) => {
        // If argument is a Map, convert to plain object
        if (arg instanceof Map) {
          return {
            author: arg.get('author') as string,
            content: arg.get('content') as string,
            timestamp: Number(arg.get('timestamp')),
          };
        }
        return arg;
      });
    }

    return result as any;
  } catch (error) {
    logBlockchain.error(
      "Failed to fetch arguments",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );
    throw new Error(`Failed to fetch arguments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get leaderboard data after resolution
 * 
 * @param contractAddress - The debate contract address
 * @returns Results object with winner and all scores
 * @throws Error if debate is not resolved yet
 */
export async function getResults(contractAddress: string): Promise<{
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
}> {
  logger.debug(LogCategory.BLOCKCHAIN, "Fetching results", { contractAddress });

  try {
    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "get_results",
      args: [],
    });

    // GenLayer returns dictionaries as JavaScript Map objects
    // Convert Map to plain object
    if (result instanceof Map) {
      const allScores = result.get('all_scores') || [];

      // Convert allScores to array if it's not already
      const scoresArray = Array.isArray(allScores) ? allScores : [];

      // Convert each score Map to plain object
      const convertedScores = scoresArray.map((scoreMap: any) => {
        if (scoreMap instanceof Map) {
          const breakdownMap = scoreMap.get('breakdown');
          const breakdown = breakdownMap instanceof Map ? {
            logic_reasoning: Number(breakdownMap.get('logic_reasoning')),
            evidence_facts: Number(breakdownMap.get('evidence_facts')),
            clarity: Number(breakdownMap.get('clarity')),
            relevance: Number(breakdownMap.get('relevance')),
            originality: Number(breakdownMap.get('originality')),
            persuasiveness: Number(breakdownMap.get('persuasiveness')),
          } : {
            logic_reasoning: 0,
            evidence_facts: 0,
            clarity: 0,
            relevance: 0,
            originality: 0,
            persuasiveness: 0,
          };

          return {
            address: scoreMap.get('address') as string,
            score: Number(scoreMap.get('score')),
            reasoning: scoreMap.get('reasoning') as string,
            breakdown,
          };
        }
        return scoreMap;
      });

      return {
        winner: result.get('winner') as string,
        winner_score: Number(result.get('winner_score')),
        all_scores: convertedScores,
      };
    }

    return result as any;
  } catch (error) {
    logBlockchain.error(
      "Failed to fetch results",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );

    if (error instanceof Error && error.message.includes("not been resolved")) {
      throw new Error("Debate has not been resolved yet");
    }

    throw new Error(`Failed to fetch results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a user has joined a debate
 * 
 * @param contractAddress - The debate contract address
 * @param userAddress - The user's wallet address
 * @returns True if user has joined, false otherwise
 */
export async function hasUserJoined(
  contractAddress: string,
  userAddress: string
): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, "Checking if user joined", {
    contractAddress,
    userAddress
  });

  try {
    // Validate inputs
    if (!contractAddress || !userAddress) {
      console.warn('Missing parameters for hasUserJoined:', { contractAddress, userAddress });
      return false;
    }

    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "has_user_joined",
      args: [userAddress],
    });

    return result as boolean;
  } catch (error) {
    // Log error but don't throw - this is a non-critical check
    // The database query should be the primary source of truth
    console.warn('Blockchain hasUserJoined check failed (non-critical):', {
      contractAddress,
      userAddress,
      error: error instanceof Error ? error.message : String(error)
    });

    logBlockchain.error(
      "Failed to check if user joined (non-critical)",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );

    // Return false as fallback - database query will be used instead
    return false;
  }
}

/**
 * Check if a debate has ended based on time
 * 
 * @param contractAddress - The debate contract address
 * @returns True if current time >= end_time, false otherwise
 */
export async function isDebateEnded(contractAddress: string): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, "Checking if debate ended", { contractAddress });

  try {
    // Get current timestamp in seconds (Unix timestamp)
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const result = await defaultClient.readContract({
      address: contractAddress as `0x${string}`,
      functionName: "is_ended",
      args: [currentTimestamp],
    });

    return result as boolean;
  } catch (error) {
    logBlockchain.error(
      "Failed to check if debate ended",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );
    throw new Error(`Failed to check if debate ended: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Evaluation result type for single argument evaluation
 */
export interface EvaluationResult {
  participant_address: string;
  total_score: number;
  logic_reasoning: number;
  evidence_facts: number;
  clarity: number;
  relevance: number;
  originality: number;
  persuasiveness: number;
  reasoning: string;
}

/**
 * Evaluate a single argument using GenLayer AI
 * 
 * @param contractAddress - The debate contract address
 * @param participantAddress - The participant's wallet address
 * @param argumentContent - The argument text to evaluate
 * @returns Evaluation result with scores and reasoning
 * @throws Error if evaluation fails
 */
export async function evaluateSingleArgument(
  contractAddress: string,
  participantAddress: string,
  argumentContent: string
): Promise<EvaluationResult> {
  logger.info(LogCategory.BLOCKCHAIN, "Evaluating single argument", {
    contractAddress,
    metadata: { participantAddress }
  });

  try {
    // Get server client with private key for write operations
    const client = getServerClient();

    // Ensure consensus smart contract is initialized
    await client.initializeConsensusSmartContract?.();

    const result = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName: "evaluate_single_argument",
      args: [participantAddress, argumentContent],
      value: BigInt(0),
    });

    // Wait for transaction to be confirmed
    const receipt = await client.waitForTransactionReceipt?.({
      hash: result as any,
      status: 'ACCEPTED' as any,
      retries: 50,
      interval: 5000,
    });

    // Parse the result from the receipt
    // GenLayer returns the evaluation result in the receipt data
    let evaluationData: any;

    // Debug: Log raw receipt and result
    logger.info(LogCategory.BLOCKCHAIN, "Raw GenLayer response", {
      metadata: {
        receiptType: typeof receipt,
        resultType: typeof result,
        hasReceipt: !!receipt,
        receiptData: receipt?.data ? JSON.stringify(receipt.data).substring(0, 500) : 'no data',
        resultStr: result ? JSON.stringify(result).substring(0, 500) : 'no result'
      }
    });

    if (receipt?.data?.result) {
      evaluationData = receipt.data.result;
    } else if (receipt?.result) {
      evaluationData = receipt.result;
    } else if (result instanceof Map) {
      evaluationData = Object.fromEntries(result);
    } else if (typeof result === 'object' && result !== null) {
      evaluationData = result;
    } else {
      evaluationData = {};
    }

    // Debug: Log parsed evaluation data
    logger.info(LogCategory.BLOCKCHAIN, "Parsed evaluation data", {
      metadata: {
        dataType: typeof evaluationData,
        isMap: evaluationData instanceof Map,
        keys: evaluationData ? Object.keys(evaluationData) : [],
        dataStr: JSON.stringify(evaluationData).substring(0, 500)
      }
    });

    // Convert Map to object if needed
    if (evaluationData instanceof Map) {
      evaluationData = {
        participant_address: evaluationData.get('participant_address'),
        total_score: Number(evaluationData.get('total_score')),
        logic_reasoning: Number(evaluationData.get('logic_reasoning')),
        evidence_facts: Number(evaluationData.get('evidence_facts')),
        clarity: Number(evaluationData.get('clarity')),
        relevance: Number(evaluationData.get('relevance')),
        originality: Number(evaluationData.get('originality')),
        persuasiveness: Number(evaluationData.get('persuasiveness')),
        reasoning: evaluationData.get('reasoning'),
      };
    }

    // Calculate total score if not provided
    const logicScore = Number(evaluationData.logic_reasoning) || 0;
    const evidenceScore = Number(evaluationData.evidence_facts) || 0;
    const clarityScore = Number(evaluationData.clarity) || 0;
    const relevanceScore = Number(evaluationData.relevance) || 0;
    const originalityScore = Number(evaluationData.originality) || 0;
    const persuasivenessScore = Number(evaluationData.persuasiveness) || 0;

    const calculatedTotal = logicScore + evidenceScore + clarityScore +
      relevanceScore + originalityScore + persuasivenessScore;

    const totalScore = Number(evaluationData.total_score) || calculatedTotal;

    logger.info(LogCategory.BLOCKCHAIN, "Argument evaluation completed", {
      contractAddress,
      metadata: {
        participantAddress,
        totalScore,
        calculatedTotal,
        breakdown: { logicScore, evidenceScore, clarityScore, relevanceScore, originalityScore, persuasivenessScore }
      }
    });

    return {
      participant_address: participantAddress,
      total_score: totalScore,
      logic_reasoning: logicScore,
      evidence_facts: evidenceScore,
      clarity: clarityScore,
      relevance: relevanceScore,
      originality: originalityScore,
      persuasiveness: persuasivenessScore,
      reasoning: String(evaluationData.reasoning || ''),
    };

  } catch (error) {
    logBlockchain.error(
      "Failed to evaluate argument",
      error instanceof Error ? error : new Error(String(error)),
      contractAddress
    );
    throw new Error(`Failed to evaluate argument: ${error instanceof Error ? error.message : String(error)}`);
  }
}

