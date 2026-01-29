/**
 * GenLayer Raw RPC Client
 * 
 * Direct JSON-RPC calls to GenLayer without address validation.
 * This bypasses both viem and ethers.js address validation issues.
 */

import { logger, LogCategory } from './logger';

// GenLayer RPC endpoint
const GENLAYER_RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';

/**
 * Make a raw JSON-RPC call to GenLayer
 */
async function rpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(GENLAYER_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }

  return data.result;
}

/**
 * Encode function selector (first 4 bytes of keccak256 hash)
 * For GenLayer, we'll use a simple approach - just the function name
 */
function encodeFunctionSelector(functionName: string): string {
  // For GenLayer, function calls might be simpler
  // We'll need to check the actual RPC format
  return functionName;
}

/**
 * Get debate metadata and current state
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
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching debate info with raw RPC', { contractAddress });

  try {
    // Try eth_call first
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from('get_debate_info').toString('hex'),
      },
      'latest',
    ]);

    logger.info(LogCategory.BLOCKCHAIN, 'Raw RPC result', { result });

    // Parse result - this will depend on GenLayer's response format
    return result as any;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch debate info with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch debate info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get list of all participants
 */
export async function getParticipants(contractAddress: string): Promise<Array<{
  address: string;
  joined_at: number;
  has_submitted: boolean;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching participants with raw RPC', { contractAddress });

  try {
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from('get_participants').toString('hex'),
      },
      'latest',
    ]);

    return result as any;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch participants with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch participants: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all arguments
 */
export async function getArguments(contractAddress: string): Promise<Array<{
  author: string;
  content: string;
  timestamp: number;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching arguments with raw RPC', { contractAddress });

  try {
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from('get_arguments').toString('hex'),
      },
      'latest',
    ]);

    return result as any;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch arguments with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch arguments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get results after resolution
 */
export async function getResults(contractAddress: string): Promise<{
  winner: string;
  winner_score: number;
  all_scores: Array<{
    address: string;
    score: number;
    reasoning: string;
  }>;
}> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching results with raw RPC', { contractAddress });

  try {
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from('get_results').toString('hex'),
      },
      'latest',
    ]);

    return result as any;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch results with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );

    if (error instanceof Error && error.message.includes('not been resolved')) {
      throw new Error('Debate has not been resolved yet');
    }

    throw new Error(`Failed to fetch results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if user has joined
 */
export async function hasUserJoined(
  contractAddress: string,
  userAddress: string
): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Checking if user joined with raw RPC', {
    contractAddress,
    userAddress,
  });

  try {
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from(`has_user_joined:${userAddress}`).toString('hex'),
      },
      'latest',
    ]);

    return result as boolean;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to check if user joined with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to check if user joined: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if debate has ended
 */
export async function isDebateEnded(contractAddress: string): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Checking if debate ended with raw RPC', { contractAddress });

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const result = await rpcCall('eth_call', [
      {
        to: contractAddress,
        data: '0x' + Buffer.from(`is_ended:${currentTimestamp}`).toString('hex'),
      },
      'latest',
    ]);

    return result as boolean;
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to check if debate ended with raw RPC',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to check if debate ended: ${error instanceof Error ? error.message : String(error)}`);
  }
}
