"""Configuration management for the Mental Health Screening Assistant."""

import os
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration settings."""
    
    # API Configuration
    # GEMINI_API_KEY removed
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # Session Configuration
    SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))
    MAX_SESSIONS: int = int(os.getenv("MAX_SESSIONS", "1000"))
    
    # Crisis Response Configuration
    CRISIS_HELPLINE_US: str = os.getenv("CRISIS_HELPLINE_US", "988")
    CRISIS_HELPLINE_INTERNATIONAL: str = os.getenv("CRISIS_HELPLINE_INTERNATIONAL", "+1-800-273-8255")
    EMERGENCY_SERVICES: str = os.getenv("EMERGENCY_SERVICES", "911")
    EMERGENCY_RESOURCES_CONFIG_FILE: str = os.getenv("EMERGENCY_RESOURCES_CONFIG_FILE", "emergency_resources.json")
    
    # Safety Configuration
    ENABLE_CRISIS_DETECTION: bool = os.getenv("ENABLE_CRISIS_DETECTION", "True").lower() == "true"
    CRISIS_TRIGGER_WORDS: List[str] = os.getenv("CRISIS_TRIGGER_WORDS", "suicide,self-harm,kill myself,hurt others,end it all").split(",")
    
    @classmethod
    def validate(cls) -> bool:
        """Validate that required configuration is present."""
        # Validation for GEMINI_API_KEY removed
        return True

# Global configuration instance
config = Config()