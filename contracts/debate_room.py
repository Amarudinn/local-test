# v0.2.0
# { "Depends": "py-genlayer:latest" }

from genlayer import *
from dataclasses import dataclass
import json
import re

def parse_llm_json_response(result: str, expected_key: str) -> any:
    """
    Parse JSON response from LLM with robust error handling and fallback extraction.
    
    Args:
        result: Raw response from LLM
        expected_key: The key to extract from the JSON response
    
    Returns:
        The value associated with the expected_key, or full dict if key is None
    
    Raises:
        Exception: If JSON parsing and regex extraction both fail
    """
    print("Response from LLM: ", result)
    # Clean and parse the JSON result more robustly
    cleaned_result = result.strip()
    # Remove markdown code blocks if present
    if cleaned_result.startswith("```json"):
        cleaned_result = cleaned_result[7:]
    if cleaned_result.startswith("```"):
        cleaned_result = cleaned_result[3:]
    if cleaned_result.endswith("```"):
        cleaned_result = cleaned_result[:-3]
    cleaned_result = cleaned_result.strip()
    
    try:
        json_result = json.loads(cleaned_result)
        if expected_key is None:
            return json_result
        value = json_result[expected_key]
        print(f'LLM calculated {expected_key}: {value}')
        return value
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Raw result: {result}")
        print(f"Cleaned result: {cleaned_result}")
        # Fallback: try to extract just the value using regex
        if expected_key:
            pattern = rf'"{expected_key}"\s*:\s*"([^"]+)"'
            match = re.search(pattern, cleaned_result)
            if match:
                value = match.group(1)
                print(f'Extracted {expected_key} from regex: {value}')
                return value
        raise Exception(f"Could not parse JSON response: {result}")

@allow_storage
@dataclass
class Participant:
    """Represents a participant in the debate"""
    address: Address
    joined_at: u64
    has_submitted: bool

@allow_storage
@dataclass
class Argument:
    """Represents an argument submitted by a participant"""
    author: Address
    content: str
    timestamp: u64

@allow_storage
@dataclass
class ScoreBreakdown:
    """Detailed breakdown of scores for each evaluation criterion (6 criteria)"""
    logic_reasoning: u8      # 0-25 points (25% weight)
    evidence_facts: u8       # 0-20 points (20% weight)
    clarity: u8              # 0-15 points (15% weight)
    relevance: u8            # 0-15 points (15% weight)
    originality: u8          # 0-15 points (15% weight)
    persuasiveness: u8       # 0-10 points (10% weight)

@allow_storage
@dataclass
class ParticipantScore:
    """Represents the score and reasoning for a participant after AI judging"""
    address: Address
    score: u8  # 0-100 (sum of all breakdown scores)
    reasoning: str
    breakdown: ScoreBreakdown  # Detailed score breakdown

# Contract class
class DebateRoom(gl.Contract):
    """
    DebateRoom smart contract for decentralized debates with AI judging.
    
    V0.2.0 Changes:
    - New 6-criteria scoring system (removed rebuttal_quality, added originality + persuasiveness)
    - Added evaluate_single_argument for real-time individual evaluation
    - Scores: Logic (25%), Evidence (20%), Clarity (15%), Relevance (15%), Originality (15%), Persuasiveness (10%)
    
    Each debate is an independent contract instance where users can:
    1. Join the debate and submit one argument
    2. Wait for the debate to end
    3. Arguments are evaluated individually by AI in real-time
    4. View the leaderboard with scores and reasoning
    """
    
    # Debate metadata
    topic: str                                    # Debate title (max 200 chars)
    description: str                              # Detailed explanation (max 1000 chars)
    creator: Address                              # Address of debate creator
    created_at: u64                               # Block timestamp of creation
    duration_seconds: u64                         # Debate duration in seconds
    end_time: u64                                 # Calculated end timestamp
    status: str                                   # "OPEN", "ONGOING", "ENDED", "RESOLVED"
    participant_count: u64                        # Number of participants (TreeMap doesn't have len())
    max_participants: u64                         # Maximum number of participants allowed (default: 10)
    
    # Participants and arguments
    participants: TreeMap[Address, Participant]   # Map of participant addresses to data
    arguments: DynArray[Argument]                 # Ordered list of all arguments
    
    # Results (after resolution)
    winner: Address                               # Winner address (after resolution)
    winner_score: u8                              # Winner's score 0-100
    all_scores: TreeMap[Address, ParticipantScore] # All participant scores

    
    def __init__(self, topic: str, description: str, duration_minutes: int):
        """
        Initialize a new debate room.
        
        Args:
            topic: Debate title (1-200 characters)
            description: Detailed explanation (1-1000 characters)
            duration_minutes: Debate duration in minutes (must be positive integer)
        
        Raises:
            Exception: If validation fails
        """
        # Validate inputs
        if len(topic) == 0 or len(topic) > 200:
            raise Exception("Topic must be between 1 and 200 characters")
        
        if len(description) == 0 or len(description) > 1000:
            raise Exception("Description must be between 1 and 1000 characters")
        
        if duration_minutes <= 0:
            raise Exception("Duration must be a positive number")
        
        # Initialize metadata (timestamps will be set when first participant joins)
        self.topic = topic
        self.description = description
        self.creator = gl.message.sender_address
        self.created_at = u64(0)  # Will be set on first participant
        self.duration_seconds = u64(duration_minutes * 60)  # Convert minutes to seconds
        self.end_time = u64(0)  # Will be calculated on first participant
        self.status = "OPEN"
        self.participant_count = u64(0)
        self.max_participants = u64(10)  # Maximum 10 participants
        
        # Note: TreeMap and DynArray are auto-initialized by GenLayer
        # No need to call TreeMap() or DynArray() - they're already initialized from type annotations
        
        # Initialize result fields (will be set after resolution)
        # Use Address constructor directly with hex string (no from_hex method)
        self.winner = Address("0x0000000000000000000000000000000000000000")
        self.winner_score = u8(0)

    
    @gl.public.write
    def join_debate(self, argument: str, current_timestamp: int):
        """
        Join the debate and submit an argument.
        
        Args:
            argument: The participant's argument (1-500 characters)
            current_timestamp: Current Unix timestamp in seconds (from frontend)
        
        Raises:
            Exception: If validation fails or user already joined
        """
        sender = gl.message.sender_address
        
        # Validate user hasn't already joined
        if sender in self.participants:
            raise Exception("You have already submitted an argument to this debate")
        
        # Check if debate is full
        if self.participant_count >= self.max_participants:
            raise Exception(f"This debate is full. Maximum {int(self.max_participants)} participants allowed")
        
        # Validate argument length
        if len(argument) == 0 or len(argument) > 500:
            raise Exception("Argument must be between 1 and 500 characters")
        
        # Set timestamps on first participant (if not set yet)
        if self.created_at == u64(0):
            timestamp_u64 = u64(current_timestamp)
            self.created_at = timestamp_u64
            self.end_time = self.created_at + self.duration_seconds
        
        # Check if debate has ended based on time
        current_time_u64 = u64(current_timestamp)
        if current_time_u64 >= self.end_time:
            raise Exception("This debate has ended and is no longer accepting arguments")
        
        # Validate debate status (must be OPEN or ONGOING)
        if self.status == "ENDED":
            raise Exception("This debate has ended and is no longer accepting arguments")
        
        if self.status == "RESOLVED":
            raise Exception("This debate has been resolved and is no longer accepting arguments")
        
        # Change status to ONGOING on first participant
        if self.status == "OPEN":
            self.status = "ONGOING"
        
        # Add participant
        timestamp_u64 = u64(current_timestamp)
        participant = Participant(
            address=sender,
            joined_at=timestamp_u64,
            has_submitted=True
        )
        self.participants[sender] = participant
        self.participant_count = self.participant_count + u64(1)  # Increment count
        
        # Add argument
        arg = Argument(
            author=sender,
            content=argument,
            timestamp=timestamp_u64
        )
        self.arguments.append(arg)

    
    @gl.public.write
    def evaluate_single_argument(self, participant_address: str, argument_content: str) -> dict:
        """
        Evaluate a single argument using AI judging.
        Called by backend queue processor for real-time evaluation.
        
        Args:
            participant_address: The address of the participant who submitted the argument
            argument_content: The content of the argument to evaluate
        
        Returns:
            Dictionary with scores and reasoning
        """
        # Create AI evaluation prompt for single argument
        task = f"""
SYSTEM:
You are an Argument Evaluator. Evaluate this single argument based on the debate topic.
Your evaluation must be objective and based solely on the quality of the argument.

CRITERIA (assign points for each):
- Logic & Reasoning: 0-25 points - Is the argument logically sound and well-structured?
- Evidence & Facts: 0-20 points - Does it provide credible evidence, data, or examples?
- Clarity: 0-15 points - Is it clear, well-written, and easy to understand?
- Relevance: 0-15 points - Is it directly relevant to the debate topic?
- Originality: 0-15 points - Does it offer unique perspectives or creative insights?
- Persuasiveness: 0-10 points - How convincing and compelling is the argument?

Total possible: 100 points

Respond ONLY with valid JSON in this exact format:
{{
    "logic_reasoning": <0-25>,
    "evidence_facts": <0-20>,
    "clarity": <0-15>,
    "relevance": <0-15>,
    "originality": <0-15>,
    "persuasiveness": <0-10>,
    "reasoning": "<Brief 1-2 sentence evaluation explaining the scores>"
}}

DEBATE TOPIC: {self.topic}
DEBATE DESCRIPTION: {self.description}
ARGUMENT TO EVALUATE: {argument_content}

EVALUATE:
"""
        
        def leader_fn():
            result = gl.nondet.exec_prompt(task)
            parsed = parse_llm_json_response(result, None)  # Get full dict
            return parsed
        
        def validator_fn(leader_result: gl.vm.Result) -> bool:
            validator_result = leader_fn()
            if not isinstance(leader_result, gl.vm.Return):
                return False
            
            leader_data = leader_result.calldata
            
            # Calculate total scores
            leader_total = (
                int(leader_data["logic_reasoning"]) +
                int(leader_data["evidence_facts"]) +
                int(leader_data["clarity"]) +
                int(leader_data["relevance"]) +
                int(leader_data["originality"]) +
                int(leader_data["persuasiveness"])
            )
            validator_total = (
                int(validator_result["logic_reasoning"]) +
                int(validator_result["evidence_facts"]) +
                int(validator_result["clarity"]) +
                int(validator_result["relevance"]) +
                int(validator_result["originality"]) +
                int(validator_result["persuasiveness"])
            )
            
            # Allow 15 point difference for consensus
            if abs(leader_total - validator_total) > 15:
                return False
            
            return True
        
        result = gl.vm.run_nondet(leader_fn, validator_fn)
        
        print(f"AI Evaluation Result for {participant_address}:", result)
        
        # Calculate total score
        total_score = (
            int(result["logic_reasoning"]) +
            int(result["evidence_facts"]) +
            int(result["clarity"]) +
            int(result["relevance"]) +
            int(result["originality"]) +
            int(result["persuasiveness"])
        )
        
        # Return evaluation result
        return {
            "participant_address": participant_address,
            "total_score": total_score,
            "logic_reasoning": int(result["logic_reasoning"]),
            "evidence_facts": int(result["evidence_facts"]),
            "clarity": int(result["clarity"]),
            "relevance": int(result["relevance"]),
            "originality": int(result["originality"]),
            "persuasiveness": int(result["persuasiveness"]),
            "reasoning": result["reasoning"]
        }

    
    @gl.public.write
    def finalize_results(self, evaluations: list, current_timestamp: int):
        """
        Finalize debate results from pre-computed evaluations.
        Called by backend after all evaluations are complete and debate has ended.
        
        Args:
            evaluations: List of evaluation dictionaries with scores
            current_timestamp: Current Unix timestamp in seconds
        """
        # Validate debate has ended
        current_time_u64 = u64(current_timestamp)
        if current_time_u64 < self.end_time:
            raise Exception("Debate has not ended yet")
        
        # Validate not already resolved
        if self.status == "RESOLVED":
            raise Exception("Debate has already been resolved")
        
        # Process each evaluation and store scores
        winner_address = None
        winner_score_value = 0
        
        for eval_data in evaluations:
            addr = Address(eval_data["participant_address"])
            
            # Extract scores
            logic = u8(int(eval_data["logic_reasoning"]))
            evidence = u8(int(eval_data["evidence_facts"]))
            clarity = u8(int(eval_data["clarity"]))
            relevance = u8(int(eval_data["relevance"]))
            originality = u8(int(eval_data["originality"]))
            persuasiveness = u8(int(eval_data["persuasiveness"]))
            
            total_score = u8(int(eval_data["total_score"]))
            reasoning = eval_data["reasoning"]
            
            # Create breakdown object
            breakdown = ScoreBreakdown(
                logic_reasoning=logic,
                evidence_facts=evidence,
                clarity=clarity,
                relevance=relevance,
                originality=originality,
                persuasiveness=persuasiveness
            )
            
            # Store score
            participant_score = ParticipantScore(
                address=addr,
                score=total_score,
                reasoning=reasoning,
                breakdown=breakdown
            )
            self.all_scores[addr] = participant_score
            
            # Track winner (highest score)
            if total_score > winner_score_value:
                winner_score_value = total_score
                winner_address = addr
        
        # Set winner
        if winner_address is not None:
            self.winner = winner_address
            self.winner_score = u8(winner_score_value)
        
        # Update status
        self.status = "RESOLVED"

    
    @gl.public.view
    def get_debate_info(self) -> dict:
        """
        Get debate metadata and current state.
        
        Returns:
            Dictionary with debate information
        """
        return {
            "topic": self.topic,
            "description": self.description,
            "creator": self.creator.as_hex,
            "created_at": int(self.created_at),
            "duration_seconds": int(self.duration_seconds),
            "end_time": int(self.end_time),
            "status": self.status,
            "participant_count": int(self.participant_count),
            "max_participants": int(self.max_participants)
        }
    
    @gl.public.view
    def get_participants(self) -> list:
        """
        Get list of all participants.
        
        Returns:
            List of participant dictionaries
        """
        participants_list = []
        for addr, participant in self.participants.items():
            participants_list.append({
                "address": addr.as_hex,
                "joined_at": int(participant.joined_at),
                "has_submitted": participant.has_submitted
            })
        return participants_list
    
    @gl.public.view
    def get_arguments(self) -> list:
        """
        Get all arguments in chronological order.
        
        Returns:
            List of argument dictionaries
        """
        arguments_list = []
        for arg in self.arguments:
            arguments_list.append({
                "author": arg.author.as_hex,
                "content": arg.content,
                "timestamp": int(arg.timestamp)
            })
        return arguments_list
    
    @gl.public.view
    def get_results(self) -> dict:
        """
        Get leaderboard data after resolution.
        
        Returns:
            Dictionary with results (only available after resolution)
        
        Raises:
            Exception: If debate is not resolved yet
        """
        if self.status != "RESOLVED":
            raise Exception("Debate has not been resolved yet")
        
        # Build leaderboard
        scores_list = []
        for addr, score_data in self.all_scores.items():
            scores_list.append({
                "address": addr.as_hex,
                "score": int(score_data.score),
                "reasoning": score_data.reasoning,
                "breakdown": {
                    "logic_reasoning": int(score_data.breakdown.logic_reasoning),
                    "evidence_facts": int(score_data.breakdown.evidence_facts),
                    "clarity": int(score_data.breakdown.clarity),
                    "relevance": int(score_data.breakdown.relevance),
                    "originality": int(score_data.breakdown.originality),
                    "persuasiveness": int(score_data.breakdown.persuasiveness)
                }
            })
        
        # Sort by score descending
        scores_list.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "winner": self.winner.as_hex,
            "winner_score": int(self.winner_score),
            "all_scores": scores_list
        }
    
    @gl.public.view
    def has_user_joined(self, address: Address) -> bool:
        """
        Check if a user has joined the debate.
        
        Args:
            address: The address to check
        
        Returns:
            True if user has joined, False otherwise
        """
        return address in self.participants
    
    @gl.public.view
    def is_ended(self, current_timestamp: int) -> bool:
        """
        Check if the debate has ended based on time.
        
        Args:
            current_timestamp: Current Unix timestamp in seconds (from frontend)
        
        Returns:
            True if current time >= end_time, False otherwise
        """
        current_time_u64 = u64(current_timestamp)
        return current_time_u64 >= self.end_time
