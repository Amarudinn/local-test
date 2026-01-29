/**
 * GenLayer Ethers.js Client
 * 
 * Uses ethers.js JsonRpcProvider for read operations to bypass viem address validation issues.
 * GenLayer uses 64-character addresses which viem doesn't support.
 * 
 * Note: We use raw JSON-RPC calls instead of ethers.Contract to avoid address validation.
 */

import { ethers } from 'ethers';
import { logger, LogCategory } from './logger';

// GenLayer RPC endpoint
const GENLAYER_RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';

// Create ethers provider for GenLayer
const provider = new ethers.JsonRpcProvider(GENLAYER_RPC_URL, {
  chainId: 61999,
  name: 'GenLayer',
  ensAddress: null // Disable ENS resolution
});

/**
 * Helper function to make eth_call JSON-RPC requests
 * This bypasses ethers.js address validation
 */
async function ethCall(contractAddress: string, data: string): Promise<string> {
  const result = await provider.send('eth_call', [
    {
      to: contractAddress,
      data: data
    },
    'latest'
  ]);
  return result;
}

/**
 * Encode function call data
 */
function encodeFunctionCall(functionSignature: string, params: any[] = []): string {
  const iface = new ethers.Interface([functionSignature]);
  const functionName = functionSignature.match(/function (\w+)/)?.[1];
  if (!functionName) throw new Error('Invalid function signature');
  return iface.encodeFunctionData(functionName, params);
}

/**
 * Decode function result
 */
function decodeFunctionResult(functionSignature: string, data: string): any {
  const iface = new ethers.Interface([functionSignature]);
  const functionName = functionSignature.match(/function (\w+)/)?.[1];
  if (!functionName) throw new Error('Invalid function signature');
  return iface.decodeFunctionResult(functionName, data);
}

/**
 * Get debate metadata and current state using ethers.js
 * 
 * @param contractAddress - The debate contract address (64-char GenLayer format)
 * @returns Debate information object
 */
export async function getDebateInfoEthers(contractAddress: string): Promise<{
  topic: string;
  description: string;
  creator: string;
  created_at: number;
  duration_seconds: number;
  end_time: number;
  status: 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED';
  participant_count: number;
}> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching debate info with ethers.js', { contractAddress });
  
  try {
    // Encode function call
    const data = encodeFunctionCall(
      'function get_debate_info() view returns (tuple(string topic, string description, string creator, uint256 created_at, uint256 duration_seconds, uint256 end_time, string status, uint256 participant_count))'
    );
    
    // Make eth_call
    const result = await ethCall(contractAddress, data);
    
    // Decode result
    const decoded = decodeFunctionResult(
      'function get_debate_info() view returns (tuple(string topic, string description, string creator, uint256 created_at, uint256 duration_seconds, uint256 end_time, string status, uint256 participant_count))',
      result
    );
    
    // Parse the result
    const info = decoded[0];
    return {
      topic: info.topic || info[0],
      description: info.description || info[1],
      creator: info.creator || info[2],
      created_at: Number(info.created_at || info[3]),
      duration_seconds: Number(info.duration_seconds || info[4]),
      end_time: Number(info.end_time || info[5]),
      status: (info.status || info[6]) as 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED',
      participant_count: Number(info.participant_count || info[7])
    };
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch debate info with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch debate info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get list of all participants using ethers.js
 */
export async function getParticipantsEthers(contractAddress: string): Promise<Array<{
  address: string;
  joined_at: number;
  has_submitted: boolean;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching participants with ethers.js', { contractAddress });
  
  try {
    const data = encodeFunctionCall(
      'function get_participants() view returns (tuple(string addr, uint256 joined_at, bool has_submitted)[])'
    );
    
    const result = await ethCall(contractAddress, data);
    
    const decoded = decodeFunctionResult(
      'function get_participants() view returns (tuple(string addr, uint256 joined_at, bool has_submitted)[])',
      result
    );
    
    return decoded[0].map((p: any) => ({
      address: p.addr || p[0],
      joined_at: Number(p.joined_at || p[1]),
      has_submitted: p.has_submitted || p[2]
    }));
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch participants with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch participants: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all arguments using ethers.js
 */
export async function getArgumentsEthers(contractAddress: string): Promise<Array<{
  author: string;
  content: string;
  timestamp: number;
}>> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching arguments with ethers.js', { contractAddress });
  
  try {
    const data = encodeFunctionCall(
      'function get_arguments() view returns (tuple(string author, string content, uint256 timestamp)[])'
    );
    
    const result = await ethCall(contractAddress, data);
    
    const decoded = decodeFunctionResult(
      'function get_arguments() view returns (tuple(string author, string content, uint256 timestamp)[])',
      result
    );
    
    return decoded[0].map((arg: any) => ({
      author: arg.author || arg[0],
      content: arg.content || arg[1],
      timestamp: Number(arg.timestamp || arg[2])
    }));
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch arguments with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to fetch arguments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get results after resolution using ethers.js
 */
export async function getResultsEthers(contractAddress: string): Promise<{
  winner: string;
  winner_score: number;
  all_scores: Array<{
    address: string;
    score: number;
    reasoning: string;
  }>;
}> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Fetching results with ethers.js', { contractAddress });
  
  try {
    const data = encodeFunctionCall(
      'function get_results() view returns (tuple(string winner, uint256 winner_score, tuple(string addr, uint256 score, string reasoning)[] all_scores))'
    );
    
    const result = await ethCall(contractAddress, data);
    
    const decoded = decodeFunctionResult(
      'function get_results() view returns (tuple(string winner, uint256 winner_score, tuple(string addr, uint256 score, string reasoning)[] all_scores))',
      result
    );
    
    const res = decoded[0];
    return {
      winner: res.winner || res[0],
      winner_score: Number(res.winner_score || res[1]),
      all_scores: (res.all_scores || res[2]).map((score: any) => ({
        address: score.addr || score[0],
        score: Number(score.score || score[1]),
        reasoning: score.reasoning || score[2]
      }))
    };
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to fetch results with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    
    if (error instanceof Error && error.message.includes('not been resolved')) {
      throw new Error('Debate has not been resolved yet');
    }
    
    throw new Error(`Failed to fetch results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if user has joined using ethers.js
 */
export async function hasUserJoinedEthers(
  contractAddress: string,
  userAddress: string
): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Checking if user joined with ethers.js', { 
    contractAddress,
    userAddress 
  });
  
  try {
    const data = encodeFunctionCall(
      'function has_user_joined(string user) view returns (bool)',
      [userAddress]
    );
    
    const result = await ethCall(contractAddress, data);
    
    const decoded = decodeFunctionResult(
      'function has_user_joined(string user) view returns (bool)',
      result
    );
    
    return decoded[0];
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to check if user joined with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to check if user joined: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if debate has ended using ethers.js
 */
export async function isDebateEndedEthers(contractAddress: string): Promise<boolean> {
  logger.debug(LogCategory.BLOCKCHAIN, 'Checking if debate ended with ethers.js', { contractAddress });
  
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const data = encodeFunctionCall(
      'function is_ended(uint256 current_timestamp) view returns (bool)',
      [currentTimestamp]
    );
    
    const result = await ethCall(contractAddress, data);
    
    const decoded = decodeFunctionResult(
      'function is_ended(uint256 current_timestamp) view returns (bool)',
      result
    );
    
    return decoded[0];
  } catch (error) {
    logger.error(
      LogCategory.BLOCKCHAIN,
      'Failed to check if debate ended with ethers.js',
      error instanceof Error ? error : new Error(String(error))
    );
    throw new Error(`Failed to check if debate ended: ${error instanceof Error ? error.message : String(error)}`);
  }
}
