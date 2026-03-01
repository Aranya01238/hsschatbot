"""
Conversation flow management for mental health screening.
Handles conversation state transitions using deterministic logic derived from botConfig.json.
"""

import json
import logging
import os
import random
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from datetime import datetime

# We don't need GeminiClient anymore.
from session_manager import SessionManager, SessionData, ConversationPhase, ScreeningTool
from safety_monitor import SafetyMonitor, CrisisOverrideHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Re-defining ConversationContext locally if needed, though strictly we are using the JSON config now.
# But existing tests or session manager might rely on these enums if imported?
# The SessionManager uses ConversationPhase and ScreeningTool.
# ConversationContext was a Gemini thing. We can likely drop it if we don't use it in internal signatures.
# However, to be safe and compatible with any other imports I might have missed (though I checked), I'll define a simple one or just skip it if not used.
# The new logic relies on phases from SessionManager.

class ConversationFlowManager:
    """
    Manages conversation flow and state transitions for mental health screening.
    Uses deterministic logic driven by botConfig.json.
    """
    
    def __init__(self, session_manager: SessionManager, safety_monitor: SafetyMonitor, config_path: str = "botConfig.json"):
        """Initialize conversation flow manager."""
        self.session_manager = session_manager
        self.safety_monitor = safety_monitor
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Initialize helpers
        self.tool_mapping = {
            "PHQ9": ScreeningTool.PHQ9,
            "GAD7": ScreeningTool.GAD7,
            "GHQ12": ScreeningTool.GHQ12
        }
        
        logger.info("Conversation flow manager initialized (Strict Deterministic Mode)")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load bot configuration from JSON file"""
        try:
            # Try absolute path or relative to backend
            paths_to_try = [
                config_path,
                os.path.join("backend", config_path),
                os.path.join(os.path.dirname(__file__), config_path)
            ]
            
            for path in paths_to_try:
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        return json.load(f)
            
            print(f"Warning: Could not find {config_path}. Using empty config.")
            return {}
        except Exception as e:
            print(f"Error loading config: {e}")
            return {}
    
    def process_user_message(self, session_id: str, user_message: str) -> Dict[str, Any]:
        """
        Process user message and generate appropriate response based on conversation state.
        
        Args:
            session_id: Session identifier
            user_message: User's input message
            
        Returns:
            Dictionary containing AI response and updated session state
        """
        try:
            # Get session data
            session = self.session_manager.get_session(session_id)
            if not session:
                return {
                    "error": "Session not found or expired",
                    "ai_response": None,
                    "current_phase": None,
                    "crisis_detected": False
                }
            
            # Check for crisis indicators first
            crisis_response = self.safety_monitor.check_for_crisis(user_message)
            if crisis_response.requires_override: # Note: SafetyMonitor return uses result.requires_override
                # Handle crisis situation
                return self._handle_crisis_response(session_id, user_message, crisis_response)
            
            # Process based on current conversation phase
            current_phase = session.current_phase
            
            # If crisis was previously detected, do not proceed with normal flow unless reset?
            # User requirement: "Stop everything. Do not continue the questionnaire."
            if session.crisis_detected:
                 return {
                    "ai_response": self.safety_monitor._get_crisis_message(),
                    "current_phase": ConversationPhase.CRISIS_RESPONSE.value,
                    "crisis_detected": True,
                    "next_action": "stop"
                }

            if current_phase == ConversationPhase.GREETING:
                return self._handle_greeting_phase(session_id, user_message, session)
            elif current_phase == ConversationPhase.TRIAGE:
                return self._handle_triage_phase(session_id, user_message, session)
            elif current_phase == ConversationPhase.SCREENING:
                return self._handle_screening_phase(session_id, user_message, session)
            elif current_phase == ConversationPhase.RESULTS:
                # Results phase usually ends, but if they text again, we might just say bye or restart
                return {
                    "ai_response": self.config.get("intro", {}).get("exitResponse", "Take care."),
                    "current_phase": ConversationPhase.RESULTS.value,
                    "crisis_detected": False
                }
            elif current_phase == ConversationPhase.CRISIS_RESPONSE:
                 return {
                    "ai_response": self.safety_monitor._get_crisis_message(),
                    "current_phase": ConversationPhase.CRISIS_RESPONSE.value,
                    "crisis_detected": True
                }
            else:
                return self._handle_unknown_phase(session_id, user_message, session)
                
        except Exception as e:
            logger.error(f"Error processing user message: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "error": f"Failed to process message: {str(e)}",
                "ai_response": "I'm sorry, I encountered an error. Let's try again.",
                "current_phase": session.current_phase.value if session else None,
                "crisis_detected": False
            }
    
    def _handle_greeting_phase(self, session_id: str, user_message: str, session: SessionData) -> Dict[str, Any]:
        """Handle greeting phase."""
        try:
            intro_config = self.config.get("intro", {})
            welcome_msg = intro_config.get("welcome", "")
            
            # If this is the very first interaction (empty history), send welcome
            # Or if the last message from agent wasn't the welcome message?
            # Simple check: if NO history, it's start.
            if not session.conversation_history:
                ai_response = welcome_msg
                self.session_manager.add_conversation(session_id, user_message, ai_response, ConversationPhase.GREETING.value)
                return {
                    "ai_response": ai_response,
                    "current_phase": ConversationPhase.GREETING.value,
                    "crisis_detected": False,
                    "next_action": "wait_for_intro_response"
                }

            # If user responded to welcome
            user_text_lower = user_message.lower().strip()
            
            # Check for YES
            if any(k in user_text_lower for k in intro_config.get("yesKeywords", [])):
                # Move to Mood Selection
                mood_prompt = self.config.get("moodSelection", {}).get("prompt", "")
                self.session_manager.update_session(session_id, current_phase=ConversationPhase.TRIAGE.value)
                self.session_manager.add_conversation(session_id, user_message, mood_prompt, ConversationPhase.TRIAGE.value)
                return {
                    "ai_response": mood_prompt,
                    "current_phase": ConversationPhase.TRIAGE.value,
                    "crisis_detected": False,
                    "next_action": "get_mood"
                }
            
            # Check for NO
            elif any(k in user_text_lower for k in intro_config.get("noKeywords", [])):
                exit_msg = intro_config.get("exitResponse", "")
                self.session_manager.add_conversation(session_id, user_message, exit_msg, ConversationPhase.GREETING.value)
                return {
                    "ai_response": exit_msg,
                    "current_phase": ConversationPhase.GREETING.value,
                    "crisis_detected": False,
                    "completed": True
                }
            
            # Unclear response
            else:
                retry_msg = "I didn't quite catch that. Would you like to continue? Please say 'yes' or 'no'."
                # Don't add to history to keep it clean? Or do add? Let's add.
                self.session_manager.add_conversation(session_id, user_message, retry_msg, ConversationPhase.GREETING.value)
                return {
                    "ai_response": retry_msg,
                    "current_phase": ConversationPhase.GREETING.value,
                    "crisis_detected": False
                }
                
        except Exception as e:
            logger.error(f"Error in greeting phase: {str(e)}")
            return self._get_error_response(session, str(e))
    
    def _handle_triage_phase(self, session_id: str, user_message: str, session: SessionData) -> Dict[str, Any]:
        """Handle mood selection and routing."""
        try:
            user_text_lower = user_message.lower()
            routing = self.config.get("moodSelection", {}).get("routing", {})
            
            selected_tool_name = None
            
            # Check keywords
            for tool_name, keywords in routing.items():
                if any(k in user_text_lower for k in keywords):
                    selected_tool_name = tool_name
                    break
            
            if not selected_tool_name:
                retry_msg = "Could you tell me if you are feeling more sad, anxious, or just generally stressed?"
                self.session_manager.add_conversation(session_id, user_message, retry_msg, ConversationPhase.TRIAGE.value)
                return {
                    "ai_response": retry_msg,
                    "current_phase": ConversationPhase.TRIAGE.value,
                    "crisis_detected": False
                }
                
            # Valid tool selected
            tool_enum = self.tool_mapping.get(selected_tool_name)
            if not tool_enum:
                # Default safety
                tool_enum = ScreeningTool.GHQ12
                selected_tool_name = "GHQ12"
            
            # Update session
            self.session_manager.update_session(
                session_id, 
                selected_tool=tool_enum.value,
                current_phase=ConversationPhase.SCREENING.value,
                responses={} # Clear any old responses if any
            )
            
            # Get first question
            questions = self.config.get("questionnaires", {}).get(selected_tool_name, {}).get("questions", [])
            first_q = questions[0]
            
            transition_msg = f"I understand. Let's talk a bit more about that. {first_q}"
            
            self.session_manager.add_conversation(session_id, user_message, transition_msg, ConversationPhase.SCREENING.value)
            
            return {
                "ai_response": transition_msg,
                "current_phase": ConversationPhase.SCREENING.value,
                "crisis_detected": False,
                "selected_tool": tool_enum.value,
                "question_number": 1
            }
            
        except Exception as e:
            logger.error(f"Error in triage phase: {str(e)}")
            return self._get_error_response(session, str(e))
    
    def _handle_screening_phase(self, session_id: str, user_message: str, session: SessionData) -> Dict[str, Any]:
        """Handle screening questions."""
        try:
            if not session.selected_tool:
                # This shouldn't happen if flow is correct, but safe recovery
                return self._handle_unknown_phase(session_id, user_message, session)
            
            tool_name = session.selected_tool.name # Enum name e.g. PHQ9
            # Check if name is consistent with config keys
            if tool_name not in self.config.get("questionnaires", {}):
                 # Try value
                 # SessionTool.PHQ9 value is "PHQ-9" maybe? Check definition?
                 # Assuming keys in config "PHQ9", "GAD7" match what we mapped in tool_mapping
                 pass
            
            # Actually, SessionTool enum members: PHQ9, GAD7, GHQ12.
            # session.selected_tool is an Enum member. .name is "PHQ9".
            
            questions = self.config.get("questionnaires", {}).get(tool_name, {}).get("questions", [])
            
            # How many answered so far?
            # session.responses is a Dict[qid, score]
            current_idx = len(session.responses)
            
            # Scoring the PREVIOUS question (because we are in the handler for the USER'S answer)
            score = self._map_response_to_score(user_message, tool_name)
            
            if score == -1:
                # Clarify
                clarify_msg = self.config.get("answerMapping", {}).get("clarifyPrompt", "Could you clarify?")
                self.session_manager.add_conversation(session_id, user_message, clarify_msg, ConversationPhase.SCREENING.value)
                return {
                    "ai_response": clarify_msg,
                    "current_phase": ConversationPhase.SCREENING.value,
                    "crisis_detected": False
                }
            
            # Check PHQ9 Q9 crisis
            # Config has "crisisQuestionIndex": 8 (0-indexed) -> 9th question
            crisis_idx = self.config.get("questionnaires", {}).get(tool_name, {}).get("crisisQuestionIndex")
            
            # note: current_idx corresponds to the index of the question just answered.
            # If 0 questions answered before this, we just answered question index 0.
            # So we check if current_idx == crisis_idx?
            # EX: crisis_idx = 8.
            # If we answer 9th question (index 8), we are at state where responses has 0..7 items? No.
            # Wait.
            # Logic:
            # 1. Ask Q1 (index 0).
            # 2. User answers Q1.
            # 3. Handler called. len(responses) is 0.
            # 4. We score user answer.
            # 5. We check if index 0 is crisis index.
            # 6. We save response. len(responses) becomes 1.
            
            # So verifying crisis check:
            if tool_name == "PHQ9" and crisis_idx is not None and current_idx == crisis_idx:
                if score > 0:
                    return self._handle_phq9_q9_crisis(session_id, user_message, session, score)

            # Save response
            qid = f"{tool_name.lower()}_{current_idx + 1}"
            self.session_manager.add_response(session_id, qid, user_message, score)
            
            # Determine NEXT question
            next_idx = current_idx + 1
            if next_idx < len(questions):
                next_q = questions[next_idx]
                self.session_manager.add_conversation(session_id, user_message, next_q, ConversationPhase.SCREENING.value)
                return {
                    "ai_response": next_q,
                    "current_phase": ConversationPhase.SCREENING.value,
                    "crisis_detected": False,
                    "question_number": next_idx + 1
                }
            else:
                # All done -> Results
                return self._transition_to_results(session_id, user_message, session)

        except Exception as e:
            logger.error(f"Error in screening phase: {str(e)}")
            return self._get_error_response(session, str(e))

    def _map_response_to_score(self, user_text: str, tool_name: str) -> int:
        """Map answer to score based on config scales."""
        text = user_text.lower()
        
        # Determine strict scale to use
        mapping_config = self.config.get("answerMapping", {})
        scale = mapping_config.get("standardScale")
        if tool_name == "GHQ12":
            scale = mapping_config.get("ghqScale")
            
        # Iterate 3 down to 0
        for score_val in ["3", "2", "1", "0"]:
            keywords = scale.get(score_val, [])
            if any(k in text for k in keywords):
                return int(score_val)
        
        return -1 # Unclear

    def _transition_to_results(self, session_id: str, user_message: str, session: SessionData) -> Dict[str, Any]:
        """Calculate score and show results."""
        try:
            # Update phase
            self.session_manager.update_session(session_id, current_phase=ConversationPhase.RESULTS.value, completed=True)
            
            # Calculate total
            total_score = session.get_total_score()
            
            # Determine logic
            tool_name = session.selected_tool.name
            
            thresholds = self.config.get("questionnaires", {}).get(tool_name, {}).get("thresholds", {})
            
            # Find severity
            severity = "minimal" # default
            # thresholds format: "minimal": [0, 4]
            # iterate and check range
            for sev_name, range_val in thresholds.items():
                if range_val[0] <= total_score <= range_val[1]:
                    severity = sev_name
                    break
             
            # Map GHQ "normal" to "minimal" key if needed
            if severity == "normal":
                severity = "minimal"
            
            result_config = self.config.get("results", {}).get(severity, {})
            if not result_config:
                 # Fallback if severity key not found (e.g. moderately_severe) -> map to severe?
                 if severity == "moderately_severe":
                     result_config = self.config.get("results", {}).get("severe", {})
                     severity = "severe" # update for clarity
                 else:
                     # Default to moderate if unknown
                     result_config = self.config.get("results", {}).get("moderate", {})

            msg = result_config.get("message", "")
            suggestions = result_config.get("suggestions", [])
            
            # Pick a suggestion
            sugg_text = ""
            if suggestions:
                sugg_text = "\n\nSuggestion: " + random.choice(suggestions)
            
            full_response = f"{msg}{sugg_text}"
            
            self.session_manager.add_conversation(session_id, user_message, full_response, ConversationPhase.RESULTS.value)
            
            return {
                "ai_response": full_response,
                "current_phase": ConversationPhase.RESULTS.value,
                "crisis_detected": False,
                "total_score": total_score,
                "severity_level": severity,
                "completed": True
            }
            
        except Exception as e:
            logger.error(f"Error results phase: {str(e)}")
            return self._get_error_response(session, str(e))

    def _handle_crisis_response(self, session_id: str, user_message: str, crisis_response) -> Dict[str, Any]:
        """Handle crisis situation with immediate intervention."""
        try:
            self.session_manager.update_session(
                session_id,
                crisis_detected=True,
                current_phase=ConversationPhase.CRISIS_RESPONSE.value
            )
            
            crisis_message = crisis_response.message
            
            self.session_manager.add_conversation(session_id, user_message, crisis_message, ConversationPhase.CRISIS_RESPONSE.value)
            
            return {
                "ai_response": crisis_message,
                "current_phase": ConversationPhase.CRISIS_RESPONSE.value,
                "crisis_detected": True,
                "next_action": "stop"
            }
        except Exception as e:
            logger.error(f"Error handling crisis: {str(e)}")
            return {"error": str(e)}

    def _handle_phq9_q9_crisis(self, session_id: str, user_message: str, session: SessionData, score: int) -> Dict[str, Any]:
        """Handle PHQ-9 Q9 crisis trigger."""
        try:
            self.session_manager.update_session(
                session_id,
                crisis_detected=True,
                current_phase=ConversationPhase.CRISIS_RESPONSE.value
            )
            
            # Save the response
            self.session_manager.add_response(session_id, "phq9_9", user_message, score)
            
            crisis_message = self.safety_monitor._get_crisis_message()
            self.session_manager.add_conversation(session_id, user_message, crisis_message, ConversationPhase.CRISIS_RESPONSE.value)
            
            return {
                "ai_response": crisis_message,
                "current_phase": ConversationPhase.CRISIS_RESPONSE.value,
                "crisis_detected": True,
                "crisis_trigger": "PHQ9_Q9"
            }
        except Exception as e:
             return {"error": str(e)}

    def _handle_unknown_phase(self, session_id: str, user_message: str, session: SessionData) -> Dict[str, Any]:
        """Handle unknown phase."""
        self.session_manager.update_session(session_id, current_phase=ConversationPhase.GREETING.value)
        msg = "Let's start over. " + self.config.get("intro", {}).get("welcome", "")
        self.session_manager.add_conversation(session_id, user_message, msg, ConversationPhase.GREETING.value)
        return {
            "ai_response": msg,
            "current_phase": ConversationPhase.GREETING.value,
            "crisis_detected": False
        }

    def _get_error_response(self, session: SessionData, error_message: str) -> Dict[str, Any]:
        return {
            "error": error_message,
            "ai_response": "I'm sorry, I encountered an error. Let's try again.",
            "current_phase": session.current_phase.value if session else None,
            "crisis_detected": False
        }
    
    def get_session_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get summary of session progress and state."""
        session = self.session_manager.get_session(session_id)
        if not session:
            return None
        
        return {
            "session_id": session.session_id,
            "user_name": session.user_name,
            "current_phase": session.current_phase.value,
            "selected_tool": session.selected_tool.value if session.selected_tool else None,
            "questions_answered": len(session.responses),
            "total_score": session.get_total_score(),
            "crisis_detected": session.crisis_detected,
            "completed": session.completed,
        }
    
    def get_conversation_history(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        session = self.session_manager.get_session(session_id)
        if session:
            return session.conversation_history
        return None
