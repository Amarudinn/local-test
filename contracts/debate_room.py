# v0.1.0
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
    cleaned_result = result.strip()
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
    logic_reasoning: u8
    evidence_facts: u8
    clarity: u8
    relevance: u8
    originality: u8
    persuasiveness: u8

@allow_storage
@dataclass
class ParticipantScore:
    """Represents the score and reasoning for a participant after AI judging"""
    address: Address
    score: u8
    reasoning: str
    breakdown: ScoreBreakdown

@allow_storage
@dataclass
class PendingEvaluation:
    """Stores individual evaluation result before final reveal"""
    participant_address: str
    total_score: u8
    logic_reasoning: u8
    evidence_facts: u8
    clarity: u8
    relevance: u8
    originality: u8
    persuasiveness: u8
    reasoning: str
    evaluated: bool

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
    
    topic: str
    description: str
    creator: Address
    created_at: u64
    duration_seconds: u64
    end_time: u64
    status: str
    participant_count: u64
    max_participants: u64
    
    participants: TreeMap[Address, Participant]
    arguments: DynArray[Argument]
    
    winner: Address
    winner_score: u8
    all_scores: TreeMap[Address, ParticipantScore]
    
    pending_evaluations: TreeMap[str, PendingEvaluation]

    weight_logic_reasoning: u8
    weight_evidence_facts: u8
    weight_clarity: u8
    weight_relevance: u8
    weight_originality: u8
    weight_persuasiveness: u8

    
    def __init__(self, topic: str, description: str, duration_minutes: int, 
                 max_participants: int = 10,
                 weight_logic_reasoning: int = 25,
                 weight_evidence_facts: int = 20,
                 weight_clarity: int = 15,
                 weight_relevance: int = 15,
                 weight_originality: int = 15,
                 weight_persuasiveness: int = 10):
        """
        Initialize a new debate room.
        
        Args:
            topic: Debate title (1-200 characters)
            description: Detailed explanation (1-1000 characters)
            duration_minutes: Debate duration in minutes (must be positive integer)
            max_participants: Maximum participants (0 = unlimited, default: 10)
            weight_*: Evaluation criteria weights (must sum to 100)
        
        Raises:
            Exception: If validation fails
        """
        if len(topic) == 0:
            raise Exception("Topic is required")
        
        if len(description) == 0 or len(description) > 1000:
            raise Exception("Description must be between 1 and 1000 characters")
        
        if duration_minutes <= 0:
            raise Exception("Duration must be a positive number")
        
        total_weight = weight_logic_reasoning + weight_evidence_facts + weight_clarity + weight_relevance + weight_originality + weight_persuasiveness
        if total_weight != 100:
            raise Exception(f"Evaluation criteria weights must sum to 100, got {total_weight}")
        
        self.topic = topic
        self.description = description
        self.creator = gl.message.sender_address
        self.created_at = u64(0)
        self.duration_seconds = u64(duration_minutes * 60)
        self.end_time = u64(0)
        self.status = "OPEN"
        self.participant_count = u64(0)
        self.max_participants = u64(max_participants)
        
        self.weight_logic_reasoning = u8(weight_logic_reasoning)
        self.weight_evidence_facts = u8(weight_evidence_facts)
        self.weight_clarity = u8(weight_clarity)
        self.weight_relevance = u8(weight_relevance)
        self.weight_originality = u8(weight_originality)
        self.weight_persuasiveness = u8(weight_persuasiveness)
        
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
        
        if sender in self.participants:
            raise Exception("You have already submitted an argument to this debate")
        
        if self.max_participants > u64(0) and self.participant_count >= self.max_participants:
            raise Exception(f"This debate is full. Maximum {int(self.max_participants)} participants allowed")
        
        if len(argument) == 0 or len(argument) > 500:
            raise Exception("Argument must be between 1 and 500 characters")
        
        if self.created_at == u64(0):
            timestamp_u64 = u64(current_timestamp)
            self.created_at = timestamp_u64
            self.end_time = self.created_at + self.duration_seconds
        
        current_time_u64 = u64(current_timestamp)
        if current_time_u64 >= self.end_time:
            raise Exception("This debate has ended and is no longer accepting arguments")
        
        if self.status == "ENDED":
            raise Exception("This debate has ended and is no longer accepting arguments")
        
        if self.status == "RESOLVED":
            raise Exception("This debate has been resolved and is no longer accepting arguments")
        
        if self.status == "OPEN":
            self.status = "ONGOING"
        
        timestamp_u64 = u64(current_timestamp)
        participant = Participant(
            address=sender,
            joined_at=timestamp_u64,
            has_submitted=True
        )
        self.participants[sender] = participant
        self.participant_count = self.participant_count + u64(1)  # Increment count
        
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
        task = f"""
SYSTEM:
You are an Argument Evaluator. Evaluate this single argument based on the debate topic.
Your evaluation must be objective and based solely on the quality of the argument.
IMPORTANT: You MUST respond in ENGLISH regardless of the language of the argument, topic, or description.

CRITERIA (assign points for each):
- Logic & Reasoning: 0-{int(self.weight_logic_reasoning)} points - Is the argument logically sound and well-structured?
- Evidence & Facts: 0-{int(self.weight_evidence_facts)} points - Does it provide credible evidence, data, or examples?
- Clarity: 0-{int(self.weight_clarity)} points - Is it clear, well-written, and easy to understand?
- Relevance: 0-{int(self.weight_relevance)} points - Is it directly relevant to the debate topic?
- Originality: 0-{int(self.weight_originality)} points - Does it offer unique perspectives or creative insights?
- Persuasiveness: 0-{int(self.weight_persuasiveness)} points - How convincing and compelling is the argument?

Total possible: 100 points

Respond ONLY with valid JSON in this exact format:
{{
    "logic_reasoning": <0-{int(self.weight_logic_reasoning)}>,
    "evidence_facts": <0-{int(self.weight_evidence_facts)}>,
    "clarity": <0-{int(self.weight_clarity)}>,
    "relevance": <0-{int(self.weight_relevance)}>,
    "originality": <0-{int(self.weight_originality)}>,
    "persuasiveness": <0-{int(self.weight_persuasiveness)}>,
    "reasoning": "<Brief 1-2 sentence evaluation explaining the scores>"
}}

DEBATE TOPIC: {self.topic}
DEBATE DESCRIPTION: {self.description}
ARGUMENT TO EVALUATE: {argument_content}

EVALUATE:
"""
        
        def leader_fn():
            result = gl.nondet.exec_prompt(task)
            parsed = parse_llm_json_response(result, None)
            return parsed
        
        def validator_fn(leader_result: gl.vm.Result) -> bool:
            validator_result = leader_fn()
            if not isinstance(leader_result, gl.vm.Return):
                return False
            
            leader_data = leader_result.calldata
            
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
            
            if abs(leader_total - validator_total) > 15:
                return False
            
            return True
        
        result = gl.vm.run_nondet(leader_fn, validator_fn)
        
        print(f"AI Evaluation Result for {participant_address}:", result)
        
        total_score = (
            int(result["logic_reasoning"]) +
            int(result["evidence_facts"]) +
            int(result["clarity"]) +
            int(result["relevance"]) +
            int(result["originality"]) +
            int(result["persuasiveness"])
        )
        
        evaluation = PendingEvaluation(
            participant_address=participant_address,
            total_score=u8(total_score),
            logic_reasoning=u8(int(result["logic_reasoning"])),
            evidence_facts=u8(int(result["evidence_facts"])),
            clarity=u8(int(result["clarity"])),
            relevance=u8(int(result["relevance"])),
            originality=u8(int(result["originality"])),
            persuasiveness=u8(int(result["persuasiveness"])),
            reasoning=result["reasoning"],
            evaluated=True
        )
        
        self.pending_evaluations[participant_address] = evaluation
        
        print(f"Stored evaluation for {participant_address}: score={total_score}")
        
        return {
            "success": True,
            "participant_address": participant_address
        }

    
    @gl.public.view
    def get_pending_evaluation(self, participant_address: str) -> dict:
        """
        Get the pending evaluation for a specific participant.
        This is a view function that can be called with readContract.
        
        Args:
            participant_address: The address of the participant
        
        Returns:
            Dictionary with evaluation scores or empty dict if not found
        """
        if participant_address not in self.pending_evaluations:
            return {
                "found": False,
                "participant_address": participant_address,
                "total_score": 0,
                "logic_reasoning": 0,
                "evidence_facts": 0,
                "clarity": 0,
                "relevance": 0,
                "originality": 0,
                "persuasiveness": 0,
                "reasoning": ""
            }
        
        evaluation = self.pending_evaluations[participant_address]
        
        return {
            "found": True,
            "participant_address": evaluation.participant_address,
            "total_score": int(evaluation.total_score),
            "logic_reasoning": int(evaluation.logic_reasoning),
            "evidence_facts": int(evaluation.evidence_facts),
            "clarity": int(evaluation.clarity),
            "relevance": int(evaluation.relevance),
            "originality": int(evaluation.originality),
            "persuasiveness": int(evaluation.persuasiveness),
            "reasoning": evaluation.reasoning
        }

    
    @gl.public.view
    def get_evaluation_criteria(self) -> dict:
        """
        Get the evaluation criteria weights for this debate.
        
        Returns:
            Dictionary with max_participants and all criteria weights
        """
        return {
            "max_participants": int(self.max_participants),
            "logic_reasoning": int(self.weight_logic_reasoning),
            "evidence_facts": int(self.weight_evidence_facts),
            "clarity": int(self.weight_clarity),
            "relevance": int(self.weight_relevance),
            "originality": int(self.weight_originality),
            "persuasiveness": int(self.weight_persuasiveness),
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
        current_time_u64 = u64(current_timestamp)
        if current_time_u64 < self.end_time:
            raise Exception("Debate has not ended yet")
        
        if self.status == "RESOLVED":
            raise Exception("Debate has already been resolved")
        
        winner_address = None
        winner_score_value = 0
        
        for eval_data in evaluations:
            addr = Address(eval_data["participant_address"])
            
            logic = u8(int(eval_data["logic_reasoning"]))
            evidence = u8(int(eval_data["evidence_facts"]))
            clarity = u8(int(eval_data["clarity"]))
            relevance = u8(int(eval_data["relevance"]))
            originality = u8(int(eval_data["originality"]))
            persuasiveness = u8(int(eval_data["persuasiveness"]))
            
            total_score = u8(int(eval_data["total_score"]))
            reasoning = eval_data["reasoning"]
            
            breakdown = ScoreBreakdown(
                logic_reasoning=logic,
                evidence_facts=evidence,
                clarity=clarity,
                relevance=relevance,
                originality=originality,
                persuasiveness=persuasiveness
            )
            
            participant_score = ParticipantScore(
                address=addr,
                score=total_score,
                reasoning=reasoning,
                breakdown=breakdown
            )
            self.all_scores[addr] = participant_score
            
            if total_score > winner_score_value:
                winner_score_value = total_score
                winner_address = addr
        
        if winner_address is not None:
            self.winner = winner_address
            self.winner_score = u8(winner_score_value)
        
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
