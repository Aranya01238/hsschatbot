"""Session management for the Mental Health Screening Assistant."""

import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field
from enum import Enum
import threading
import time
from config import config


class ConversationPhase(Enum):
    """Conversation phases during screening."""
    GREETING = "GREETING"
    TRIAGE = "TRIAGE"
    SCREENING = "SCREENING"
    RESULTS = "RESULTS"
    CRISIS_RESPONSE = "CRISIS_RESPONSE"


class ScreeningTool(Enum):
    """Available screening tools."""
    PHQ9 = "PHQ9"
    GAD7 = "GAD7"
    GHQ12 = "GHQ12"


@dataclass
class QuestionResponse:
    """Individual question response data."""
    question_id: str
    user_text: str
    mapped_score: int
    timestamp: datetime


@dataclass
class SessionData:
    """Session data structure for user interactions."""
    session_id: str
    user_name: Optional[str] = None
    country: Optional[str] = None
    start_time: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    current_phase: ConversationPhase = ConversationPhase.GREETING
    selected_tool: Optional[ScreeningTool] = None
    responses: List[QuestionResponse] = field(default_factory=list)
    has_past_diagnosis: Optional[bool] = None
    crisis_detected: bool = False
    completed: bool = False
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.now()
    
    def add_response(self, question_id: str, user_text: str, mapped_score: int):
        """Add a question response to the session."""
        response = QuestionResponse(
            question_id=question_id,
            user_text=user_text,
            mapped_score=mapped_score,
            timestamp=datetime.now()
        )
        self.responses.append(response)
        self.update_activity()
    
    def add_conversation_entry(self, user_message: str, ai_response: str, phase: str):
        """Add conversation entry to history."""
        entry = {
            "user_message": user_message,
            "ai_response": ai_response,
            "phase": phase,
            "timestamp": datetime.now().isoformat()
        }
        self.conversation_history.append(entry)
        self.update_activity()
    
    def is_expired(self, timeout_minutes: int) -> bool:
        """Check if session has expired."""
        expiry_time = self.last_activity + timedelta(minutes=timeout_minutes)
        return datetime.now() > expiry_time
    
    def get_total_score(self) -> int:
        """Calculate total score from all responses."""
        return sum(response.mapped_score for response in self.responses)


class SessionManager:
    """Manages user sessions with in-memory storage and automatic cleanup."""
    
    def __init__(self, timeout_minutes: int = None, max_sessions: int = None):
        """Initialize session manager with configuration."""
        self.timeout_minutes = timeout_minutes or config.SESSION_TIMEOUT_MINUTES
        self.max_sessions = max_sessions or config.MAX_SESSIONS
        self.sessions: Dict[str, SessionData] = {}
        self._lock = threading.RLock()
        self._cleanup_thread = None
        self._stop_cleanup = threading.Event()
        self._start_cleanup_thread()
    
    def _start_cleanup_thread(self):
        """Start background thread for session cleanup."""
        def cleanup_worker():
            while not self._stop_cleanup.wait(60):  # Check every minute
                self.cleanup_expired_sessions()
        
        self._cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        self._cleanup_thread.start()
    
    def create_session(self, user_name: Optional[str] = None, country: Optional[str] = None) -> str:
        """Create a new session and return session ID."""
        with self._lock:
            # Enforce max sessions limit
            if len(self.sessions) >= self.max_sessions:
                self.cleanup_expired_sessions()
                if len(self.sessions) >= self.max_sessions:
                    # Remove oldest session if still at limit
                    oldest_session_id = min(
                        self.sessions.keys(),
                        key=lambda sid: self.sessions[sid].last_activity
                    )
                    del self.sessions[oldest_session_id]
            
            # Generate unique session ID
            session_id = str(uuid.uuid4())
            while session_id in self.sessions:  # Ensure uniqueness
                session_id = str(uuid.uuid4())
            
            # Create session data
            session_data = SessionData(
                session_id=session_id,
                user_name=user_name,
                country=country
            )
            
            self.sessions[session_id] = session_data
            return session_id
    
    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Get session data by ID."""
        with self._lock:
            session = self.sessions.get(session_id)
            if session and not session.is_expired(self.timeout_minutes):
                session.update_activity()
                return session
            elif session:
                # Session expired, remove it
                del self.sessions[session_id]
            return None
    
    def update_session(self, session_id: str, **updates) -> bool:
        """Update session data."""
        with self._lock:
            session = self.get_session(session_id)
            if not session:
                return False
            
            # Update allowed fields
            allowed_fields = {
                'current_phase', 'selected_tool', 'has_past_diagnosis',
                'crisis_detected', 'completed', 'user_name', 'country'
            }
            
            for field, value in updates.items():
                if field in allowed_fields:
                    if field == 'current_phase' and isinstance(value, str):
                        value = ConversationPhase(value)
                    elif field == 'selected_tool' and isinstance(value, str):
                        value = ScreeningTool(value)
                    setattr(session, field, value)
            
            session.update_activity()
            return True
    
    def add_response(self, session_id: str, question_id: str, user_text: str, mapped_score: int) -> bool:
        """Add a question response to session."""
        with self._lock:
            session = self.get_session(session_id)
            if not session:
                return False
            
            session.add_response(question_id, user_text, mapped_score)
            return True
    
    def add_conversation(self, session_id: str, user_message: str, ai_response: str, phase: str) -> bool:
        """Add conversation entry to session."""
        with self._lock:
            session = self.get_session(session_id)
            if not session:
                return False
            
            session.add_conversation_entry(user_message, ai_response, phase)
            return True
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session (for data privacy)."""
        with self._lock:
            if session_id in self.sessions:
                del self.sessions[session_id]
                return True
            return False
    
    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions and return count of removed sessions."""
        with self._lock:
            expired_sessions = [
                session_id for session_id, session in self.sessions.items()
                if session.is_expired(self.timeout_minutes)
            ]
            
            for session_id in expired_sessions:
                del self.sessions[session_id]
            
            return len(expired_sessions)
    
    def get_session_count(self) -> int:
        """Get current number of active sessions."""
        with self._lock:
            return len(self.sessions)
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get session statistics."""
        with self._lock:
            total_sessions = len(self.sessions)
            completed_sessions = sum(1 for s in self.sessions.values() if s.completed)
            crisis_sessions = sum(1 for s in self.sessions.values() if s.crisis_detected)
            
            phases = {}
            for session in self.sessions.values():
                phase = session.current_phase.value
                phases[phase] = phases.get(phase, 0) + 1
            
            return {
                "total_active_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "crisis_sessions": crisis_sessions,
                "sessions_by_phase": phases,
                "timeout_minutes": self.timeout_minutes,
                "max_sessions": self.max_sessions
            }
    
    def clear_all_sessions(self):
        """Clear all sessions (for testing or emergency cleanup)."""
        with self._lock:
            self.sessions.clear()
    
    def shutdown(self):
        """Shutdown session manager and cleanup resources."""
        self._stop_cleanup.set()
        if self._cleanup_thread and self._cleanup_thread.is_alive():
            self._cleanup_thread.join(timeout=5)
        self.clear_all_sessions()


# Global session manager instance
session_manager = SessionManager()