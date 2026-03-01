"""
Crisis Detection and Safety Layer - Backend Module
Real-time monitoring for crisis indicators and emergency response
"""

import json
import os
import re
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from datetime import datetime


class CrisisLevel(Enum):
    """Crisis severity levels"""
    NONE = "NONE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


@dataclass
class CrisisResponse:
    """Crisis detection response data"""
    level: CrisisLevel
    triggered_words: List[str]
    message: str
    timestamp: datetime
    requires_override: bool


class SafetyMonitor:
    """Backend crisis detection and safety monitoring system"""
    
    def __init__(self, config_path: str = "botConfig.json"):
        """
        Initialize safety monitor with configuration
        """
        self.config = self._load_config(config_path)
        
        # Critical trigger words from config
        self.critical_triggers = self.config.get("crisis", {}).get("keywords", [])
        self.crisis_response_message = self.config.get("crisis", {}).get("response", "")
        
        # PHQ-9 Question 9 specific patterns
        # Keeping these regexes as they are robust for catching variants
        self.phq9_q9_positive_patterns = [
            r'\b(yes|sometimes|often|nearly every day|several days)\b',
            r'\b(more than half|have thought|been thinking)\b',
            r'\b(crossed my mind|considered|considering|thinking about)\b',
            r'\b(thoughts? of|idea of|wanting to)\b.*\b(die|death|harm)\b'
        ]
        
        self.phq9_q9_negative_patterns = [
            r'\b(no|never|not at all|haven\'t|don\'t)\b',
            r'\b(absolutely not|definitely not|of course not)\b'
        ]
    
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

    def check_for_crisis(self, text: str) -> CrisisResponse:
        """
        Analyze text for crisis indicators
        """
        if not text or not isinstance(text, str):
            return CrisisResponse(
                level=CrisisLevel.NONE,
                triggered_words=[],
                message="",
                timestamp=datetime.now(),
                requires_override=False
            )
        
        normalized_text = text.lower().strip()
        triggered_words = []
        
        # Check for critical triggers
        for trigger in self.critical_triggers:
            if trigger.lower() in normalized_text:
                triggered_words.append(trigger)
        
        if triggered_words:
            return CrisisResponse(
                level=CrisisLevel.CRITICAL,
                triggered_words=triggered_words,
                message=self._get_crisis_message(),
                timestamp=datetime.now(),
                requires_override=True
            )
        
        return CrisisResponse(
            level=CrisisLevel.NONE,
            triggered_words=[],
            message="",
            timestamp=datetime.now(),
            requires_override=False
        )
    
    def check_phq9_question9(self, response: str) -> bool:
        """
        Check PHQ-9 Question 9 (suicidal ideation) for positive response
        """
        if not response or not isinstance(response, str):
            return False
        
        normalized_response = response.lower().strip()
        
        # Check for clear negative responses first
        for pattern in self.phq9_q9_negative_patterns:
            if re.search(pattern, normalized_response, re.IGNORECASE):
                if len(normalized_response) < 20:
                    return False
        
        # Check for positive indicators
        for pattern in self.phq9_q9_positive_patterns:
            if re.search(pattern, normalized_response, re.IGNORECASE):
                return True
        
        return False
    
    def _get_crisis_message(self) -> str:
        """Get the crisis response message"""
        return self.crisis_response_message


class CrisisOverrideHandler:
    """Handles crisis response overrides and emergency protocols"""
    
    def __init__(self, safety_monitor: SafetyMonitor):
        self.safety_monitor = safety_monitor
        self.crisis_detected = False
        self.crisis_timestamp = None
    
    def process_user_input(self, text: str, is_phq9_q9: bool = False) -> Tuple[bool, Optional[str]]:
        """
        Process user input and determine if crisis override is needed
        """
        # Check for general crisis indicators
        crisis_response = self.safety_monitor.check_for_crisis(text)
        
        # Check PHQ-9 Question 9 specifically
        if is_phq9_q9 and self.safety_monitor.check_phq9_question9(text):
            self.crisis_detected = True
            self.crisis_timestamp = datetime.now()
            return True, self.safety_monitor._get_crisis_message()
        
        # Handle critical crisis detection
        if crisis_response.level == CrisisLevel.CRITICAL:
            self.crisis_detected = True
            self.crisis_timestamp = datetime.now()
            return True, crisis_response.message
        
        return False, None
    
    def is_crisis_active(self) -> bool:
        """Check if crisis state is currently active"""
        return self.crisis_detected
    
    def reset_crisis_state(self) -> None:
        """Reset crisis detection state"""
        self.crisis_detected = False
        self.crisis_timestamp = None