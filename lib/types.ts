/**
 * Type definitions for Ruang Debat application
 */

// ============================================================================
// Debate Types
// ============================================================================

export type DebateStatus = 'OPEN' | 'ONGOING' | 'ENDED' | 'RESOLVED';

export interface Debate {
  id: string;
  contract_address: string;
  topic: string;
  description: string;
  duration_minutes: number;
  created_at: Date;
  end_time: Date;
  status: DebateStatus;
  participant_count: number;
  max_participants?: number; // Optional for backward compatibility
  last_synced_at: Date | null;
  updated_at: Date;
  image_url?: string | null;
}

export interface Participant {
  id: string;
  debate_id: string;
  user_id: string | null;
  wallet_address: string;
  joined_at: Date;
  has_submitted: boolean;
}

export interface Argument {
  id: string;
  debate_id: string;
  participant_id: string;
  content: string;
  submitted_at: Date;
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateDebateFormData {
  topic: string;
  description: string;
  duration: string; // Duration value as string (e.g., "5m", "1h", "3d")
}

export interface CreateDebateInput {
  topic: string;
  description: string;
  durationHours: number;
}

// ============================================================================
// Duration Options
// ============================================================================

export interface DurationOption {
  label: string;
  value: string;
  minutes: number; // Changed from hours to minutes
}

export const DURATION_OPTIONS: DurationOption[] = [

  { label: '1 hour', value: '1h', minutes: 60 },
  { label: '3 hours', value: '3h', minutes: 180 },
  { label: '6 hours', value: '6h', minutes: 360 },
  { label: '12 hours', value: '12h', minutes: 720 },
  { label: '24 hours', value: '24h', minutes: 1440 },
  { label: '3 days', value: '3d', minutes: 4320 },
  { label: '7 days', value: '7d', minutes: 10080 },
];

/**
 * Convert duration string to minutes
 * @param duration - Duration string (e.g., "5m", "1h", "3d")
 * @returns Duration in minutes
 */
export function durationToMinutes(duration: string): number {
  const option = DURATION_OPTIONS.find(opt => opt.value === duration);
  if (!option) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  return option.minutes;
}

/**
 * Convert duration string to hours (for database compatibility)
 * @param duration - Duration string (e.g., "5m", "1h", "3d")
 * @returns Duration in hours
 */
export function durationToHours(duration: string): number {
  const minutes = durationToMinutes(duration);
  return minutes / 60;
}

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION = {
  TOPIC_MIN_LENGTH: 1,
  TOPIC_MAX_LENGTH: 200,
  DESCRIPTION_MIN_LENGTH: 1,
  DESCRIPTION_MAX_LENGTH: 1000,
  ARGUMENT_MIN_LENGTH: 1,
  ARGUMENT_MAX_LENGTH: 500,
} as const;

// ============================================================================
// Evaluation Criteria Types
// ============================================================================

export interface EvaluationCriteria {
  logic_reasoning: number;    // Weight for logical soundness
  evidence_facts: number;     // Weight for evidence and facts
  clarity: number;            // Weight for clarity
  relevance: number;          // Weight for relevance
  originality: number;        // Weight for originality
  persuasiveness: number;     // Weight for persuasiveness
}

export const DEFAULT_EVALUATION_CRITERIA: EvaluationCriteria = {
  logic_reasoning: 25,
  evidence_facts: 20,
  clarity: 15,
  relevance: 15,
  originality: 15,
  persuasiveness: 10,
};

// ============================================================================
// Max Participants Options
// ============================================================================

export interface ParticipantOption {
  label: string;
  value: number;  // 0 = unlimited
}

export const DEFAULT_MAX_PARTICIPANTS = 10;

export const PARTICIPANT_OPTIONS: ParticipantOption[] = [
  { label: '20 participants', value: 20 },
  { label: '50 participants', value: 50 },
  { label: '100 participants', value: 100 },
  { label: 'Unlimited', value: 0 },
];
