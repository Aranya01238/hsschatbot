# Voice-Based AI Mental Health Screening Assistant - Backend
# FastAPI server for handling API requests and session management

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from safety_monitor import SafetyMonitor, CrisisOverrideHandler
from emergency_resources import EmergencyResourceManager, EmergencyContact, CrisisMessageConfig, ResourceType
from session_manager import session_manager, ConversationPhase, ScreeningTool
from conversation_flow import ConversationFlowManager
from config import config

app = FastAPI(title="Mental Health Screening Assistant API")

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handling middleware
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if config.DEBUG else "An unexpected error occurred",
            "status_code": 500,
            "timestamp": datetime.now().isoformat()
        }
    )

# Initialize safety monitoring and emergency resources
# Initialize safety monitoring and emergency resources
# SafetyMonitor now loads from botConfig.json by default
safety_monitor = SafetyMonitor()
crisis_handler = CrisisOverrideHandler(safety_monitor)
emergency_manager = EmergencyResourceManager(config.EMERGENCY_RESOURCES_CONFIG_FILE)

# Initialize conversation flow manager
conversation_flow = ConversationFlowManager(session_manager, safety_monitor)

# Request/Response models
class SessionStartRequest(BaseModel):
    user_name: Optional[str] = None
    country: Optional[str] = None

class SessionStartResponse(BaseModel):
    session_id: str
    message: str
    timestamp: datetime

class ConversationRequest(BaseModel):
    session_id: str
    user_message: str
    current_phase: Optional[str] = None

class ConversationResponse(BaseModel):
    ai_response: str
    session_id: str
    current_phase: str
    crisis_detected: bool
    timestamp: datetime

class ScoreCalculationRequest(BaseModel):
    session_id: str
    screening_tool: str  # PHQ9, GAD7, or GHQ12
    responses: List[dict]  # List of {question_id: str, score: int}

class ScoreCalculationResponse(BaseModel):
    session_id: str
    screening_tool: str
    total_score: int
    severity_level: str
    recommendations: List[str]
    timestamp: datetime

class CrisisCheckRequest(BaseModel):
    text: str
    is_phq9_q9: Optional[bool] = False
    country: Optional[str] = None

class CrisisCheckResponse(BaseModel):
    should_override: bool
    level: str
    message: Optional[str]
    triggered_by: Optional[str]
    timestamp: datetime

class EmergencyContactRequest(BaseModel):
    name: str
    number: str
    description: str
    country: str
    resource_type: str
    available_24_7: Optional[bool] = True
    website: Optional[str] = None
    additional_info: Optional[str] = None

class EmergencyContactResponse(BaseModel):
    name: str
    number: str
    description: str
    country: str
    resource_type: str
    available_24_7: bool
    website: Optional[str]
    additional_info: Optional[str]

class CrisisMessageConfigRequest(BaseModel):
    primary_message: str
    secondary_message: Optional[str] = None
    include_contacts: Optional[bool] = True
    include_disclaimer: Optional[bool] = True
    custom_disclaimer: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Mental Health Screening Assistant API"}

# Core API endpoints for session management, conversation, and scoring

@app.post("/api/session/start", response_model=SessionStartResponse)
async def start_session(request: SessionStartRequest):
    """
    Initialize a new user session
    """
    try:
        session_id = session_manager.create_session(
            user_name=request.user_name,
            country=request.country
        )
        
        return SessionStartResponse(
            session_id=session_id,
            message="Session started successfully. Please note this is a non-diagnostic screening tool.",
            timestamp=datetime.now()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")

@app.post("/api/conversation", response_model=ConversationResponse)
async def process_conversation(request: ConversationRequest):
    """
    Process user message and return AI response using conversation flow manager
    """
    try:
        # Process message through conversation flow manager
        result = conversation_flow.process_user_message(
            request.session_id,
            request.user_message
        )
        
        # Check for errors
        if "error" in result:
            with open("debug_error.log", "a") as f:
                f.write(f"DEBUG ERROR: {result['error']}\n")
            raise HTTPException(status_code=400, detail=result["error"])
        
        return ConversationResponse(
            ai_response=result["ai_response"],
            session_id=request.session_id,
            current_phase=result["current_phase"],
            crisis_detected=result["crisis_detected"],
            timestamp=datetime.now()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process conversation: {str(e)}")

@app.post("/api/score/calculate", response_model=ScoreCalculationResponse)
async def calculate_score(request: ScoreCalculationRequest):
    """
    Calculate screening questionnaire scores
    """
    try:
        # Validate session exists
        session = session_manager.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        # Add responses to session
        for response in request.responses:
            session_manager.add_response(
                request.session_id,
                response.get("question_id", ""),
                response.get("user_text", ""),
                response.get("score", 0)
            )
        
        # Update session with screening tool and completion
        session_manager.update_session(
            request.session_id,
            selected_tool=request.screening_tool,
            current_phase="RESULTS",
            completed=True
        )
        
        # Calculate total score
        total_score = session.get_total_score()
        
        # Basic severity determination (will be enhanced in task 8)
        if request.screening_tool == "PHQ9":
            if total_score <= 4:
                severity = "minimal"
            elif total_score <= 9:
                severity = "mild"
            elif total_score <= 14:
                severity = "moderate"
            else:
                severity = "severe"
        elif request.screening_tool == "GAD7":
            if total_score <= 4:
                severity = "minimal"
            elif total_score <= 9:
                severity = "mild"
            elif total_score <= 14:
                severity = "moderate"
            else:
                severity = "severe"
        else:  # GHQ12
            if total_score <= 11:
                severity = "minimal"
            elif total_score <= 15:
                severity = "mild"
            elif total_score <= 20:
                severity = "moderate"
            else:
                severity = "severe"
        
        recommendations = [
            "This is a screening tool and not a diagnostic assessment.",
            "Consider speaking with a mental health professional for further evaluation."
        ]
        
        return ScoreCalculationResponse(
            session_id=request.session_id,
            screening_tool=request.screening_tool,
            total_score=total_score,
            severity_level=severity,
            recommendations=recommendations,
            timestamp=datetime.now()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate score: {str(e)}")

# Session management endpoints

@app.get("/api/session/{session_id}")
async def get_session_info(session_id: str):
    """
    Get session information (for debugging/monitoring)
    """
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        return {
            "session_id": session.session_id,
            "user_name": session.user_name,
            "country": session.country,
            "start_time": session.start_time.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "current_phase": session.current_phase.value,
            "selected_tool": session.selected_tool.value if session.selected_tool else None,
            "has_past_diagnosis": session.has_past_diagnosis,
            "crisis_detected": session.crisis_detected,
            "completed": session.completed,
            "response_count": len(session.responses),
            "conversation_entries": len(session.conversation_history)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session info: {str(e)}")

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session (for data privacy compliance)
    """
    try:
        success = session_manager.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@app.get("/api/conversation/{session_id}/history")
async def get_conversation_history(session_id: str):
    """
    Get conversation history for a session
    """
    try:
        history = conversation_flow.get_conversation_history(session_id)
        if history is None:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        return {"conversation_history": history}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation history: {str(e)}")

@app.get("/api/conversation/{session_id}/summary")
async def get_session_summary(session_id: str):
    """
    Get session summary with progress and state information
    """
    try:
        summary = conversation_flow.get_session_summary(session_id)
        if summary is None:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        return summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session summary: {str(e)}")

@app.get("/api/sessions/stats")
async def get_session_stats():
    """
    Get session statistics (for monitoring)
    """
    try:
        stats = session_manager.get_session_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session stats: {str(e)}")

@app.post("/api/sessions/cleanup")
async def cleanup_expired_sessions():
    """
    Manually trigger cleanup of expired sessions
    """
    try:
        removed_count = session_manager.cleanup_expired_sessions()
        return {
            "message": f"Cleanup completed. Removed {removed_count} expired sessions.",
            "removed_count": removed_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup sessions: {str(e)}")

@app.post("/api/crisis/check", response_model=CrisisCheckResponse)
async def check_for_crisis(request: CrisisCheckRequest):
    """
    Check user input for crisis indicators
    """
    try:
        should_override, override_message = crisis_handler.process_user_input(
            request.text, 
            request.is_phq9_q9
        )
        
        # Get crisis response details
        crisis_response = safety_monitor.check_for_crisis(request.text)
        
        # If override is needed, generate localized crisis message
        if should_override and request.country:
            override_message = emergency_manager.generate_crisis_message(request.country)
        elif should_override:
            override_message = emergency_manager.generate_crisis_message()
        
        return CrisisCheckResponse(
            should_override=should_override,
            level=crisis_response.level.value,
            message=override_message,
            triggered_by="PHQ9_Q9" if request.is_phq9_q9 and should_override else "TRIGGER_WORDS" if should_override else None,
            timestamp=datetime.now()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crisis check failed: {str(e)}")

@app.get("/api/crisis/status")
async def get_crisis_status():
    """
    Get current crisis detection status
    """
    return {
        "crisis_active": crisis_handler.is_crisis_active(),
        "timestamp": crisis_handler.crisis_timestamp
    }

@app.post("/api/crisis/reset")
async def reset_crisis_status():
    """
    Reset crisis detection state
    """
    crisis_handler.reset_crisis_state()
    return {"message": "Crisis state reset successfully"}

@app.get("/api/emergency/contacts")
async def get_emergency_contacts(country: Optional[str] = None):
    """
    Get emergency contacts, optionally filtered by country
    """
    try:
        if country:
            contacts = emergency_manager.get_contacts_by_country(country)
        else:
            contacts = emergency_manager.get_all_contacts()
        
        # If no configured contacts, return fallback contacts
        if not contacts:
            contacts = emergency_manager.get_fallback_contacts()
        
        return {
            "contacts": [
                EmergencyContactResponse(
                    name=contact.name,
                    number=contact.number,
                    description=contact.description,
                    country=contact.country,
                    resource_type=contact.resource_type.value,
                    available_24_7=contact.available_24_7,
                    website=contact.website,
                    additional_info=contact.additional_info
                ) for contact in contacts
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get emergency contacts: {str(e)}")

@app.post("/api/emergency/contacts")
async def add_emergency_contact(request: EmergencyContactRequest):
    """
    Add new emergency contact
    """
    try:
        contact = EmergencyContact(
            name=request.name,
            number=request.number,
            description=request.description,
            country=request.country,
            resource_type=ResourceType(request.resource_type),
            available_24_7=request.available_24_7,
            website=request.website,
            additional_info=request.additional_info
        )
        
        emergency_manager.add_contact(contact)
        emergency_manager.save_configuration()
        
        return {"message": "Emergency contact added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add emergency contact: {str(e)}")

@app.delete("/api/emergency/contacts/{name}/{country}")
async def remove_emergency_contact(name: str, country: str):
    """
    Remove emergency contact by name and country
    """
    try:
        success = emergency_manager.remove_contact(name, country)
        if success:
            emergency_manager.save_configuration()
            return {"message": "Emergency contact removed successfully"}
        else:
            raise HTTPException(status_code=404, detail="Emergency contact not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove emergency contact: {str(e)}")

@app.get("/api/emergency/message")
async def get_crisis_message(country: Optional[str] = None):
    """
    Get formatted crisis message with appropriate contacts
    """
    try:
        message = emergency_manager.generate_crisis_message(country)
        config = emergency_manager.get_crisis_message_config()
        
        return {
            "message": message,
            "config": {
                "primary_message": config.primary_message,
                "secondary_message": config.secondary_message,
                "include_contacts": config.include_contacts,
                "include_disclaimer": config.include_disclaimer,
                "custom_disclaimer": config.custom_disclaimer
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get crisis message: {str(e)}")

@app.post("/api/emergency/message/config")
async def update_crisis_message_config(request: CrisisMessageConfigRequest):
    """
    Update crisis message configuration
    """
    try:
        config = CrisisMessageConfig(
            primary_message=request.primary_message,
            secondary_message=request.secondary_message,
            include_contacts=request.include_contacts,
            include_disclaimer=request.include_disclaimer,
            custom_disclaimer=request.custom_disclaimer
        )
        
        emergency_manager.update_crisis_message_config(config)
        emergency_manager.save_configuration()
        
        return {"message": "Crisis message configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update crisis message config: {str(e)}")

@app.get("/api/emergency/validate")
async def validate_emergency_configuration():
    """
    Validate current emergency resource configuration
    """
    try:
        errors = emergency_manager.validate_configuration()
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate configuration: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import signal
    import sys
    
    def signal_handler(sig, frame):
        print("Shutting down gracefully...")
        session_manager.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)