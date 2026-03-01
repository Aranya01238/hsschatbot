# Design Document: Voice-Based AI Mental Health Screening Assistant

## Overview

The Voice-Based AI Mental Health Screening Assistant is a web application that provides accessible mental health screening through conversational AI. The system combines voice interaction, visual feedback through an animated avatar, and standardized screening questionnaires (PHQ-9, GAD-7, GHQ-12) while maintaining strict safety protocols and ethical guidelines.

The application operates as a non-diagnostic screening tool that helps users understand their mental health status and provides appropriate referrals to mental health professionals. Safety is the highest priority, with real-time crisis detection and immediate intervention protocols.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Frontend                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Avatar UI     │  │  Voice Engine   │  │ Safety Layer │ │
│  │   Component     │  │  (Web Speech)   │  │   Monitor    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           State Machine Controller                      │ │
│  │        (LISTENING / THINKING / SPEAKING)               │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API Server                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Session Store  │  │ Scoring Engine  │  │Crisis Handler│ │
│  │   (Memory)      │  │   (Backend)     │  │   (Override) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Gemini API Integration                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gemini API Service                      │
│              (Conversational Intelligence)                 │
└─────────────────────────────────────────────────────────────┘
```

### Sequence Flow

1. **Initialization**: User loads web page → Avatar displays → Disclaimer shown
2. **Voice Setup**: Browser requests microphone permission → Web Speech API initialized
3. **Greeting**: System speaks welcome → User responds with voice
4. **Triage**: System asks about primary concern → Determines screening tool
5. **Screening**: System asks questions one by one → Maps responses to scores
6. **Safety Check**: Each response checked for crisis indicators → Override if detected
7. **Scoring**: Backend calculates totals → Determines severity level
8. **Results**: System explains findings → Provides recommendations
9. **Completion**: Session data cleared → User can restart if needed

## Components and Interfaces

### Frontend Components

#### Avatar Component
```javascript
class AvatarComponent {
  states: {
    IDLE: 'idle-animation.mp4',
    LISTENING: 'listening-animation.mp4', 
    SPEAKING: 'speaking-animation.mp4',
    THINKING: 'thinking-animation.mp4'
  }
  
  setState(newState) {
    // Switch video source based on state
    // Handle smooth transitions
  }
}
```

#### Voice Engine
```javascript
class VoiceEngine {
  recognition: SpeechRecognition
  synthesis: SpeechSynthesis
  
  startListening() {
    // Configure recognition settings
    // Handle browser compatibility
    // Return promise with transcribed text
  }
  
  speak(text, callback) {
    // Configure voice settings
    // Handle interruption
    // Call callback when complete
  }
}
```

#### State Machine Controller
```javascript
class StateMachine {
  states: ['LISTENING', 'THINKING', 'SPEAKING']
  currentState: 'LISTENING'
  
  transition(newState) {
    // Update UI components
    // Manage voice engine
    // Handle state-specific logic
  }
}
```

#### Safety Monitor
```javascript
class SafetyMonitor {
  triggerWords: ['suicide', 'self-harm', 'kill myself', 'hurt others']
  
  checkForCrisis(text) {
    // Real-time text analysis
    // Return crisis level (NONE, WARNING, CRITICAL)
  }
  
  triggerCrisisResponse() {
    // Override all other responses
    // Display emergency resources
    // Terminate screening
  }
}
```

### Backend Components

#### API Routes
```
POST /api/session/start
  - Initialize new session
  - Return session ID

POST /api/conversation
  - Process user message
  - Return AI response
  - Check for crisis indicators

POST /api/score/calculate
  - Calculate questionnaire scores
  - Return severity assessment
  - Provide recommendations

POST /api/crisis/trigger
  - Handle crisis situations
  - Return emergency resources
  - Log incident (anonymized)
```

#### Session Management
```javascript
class SessionManager {
  sessions: Map<sessionId, SessionData>
  
  createSession() {
    // Generate unique session ID
    // Initialize conversation state
    // Set expiration timer
  }
  
  updateSession(sessionId, data) {
    // Update conversation history
    // Track screening progress
    // Maintain user preferences
  }
}
```

#### Scoring Engine
```javascript
class ScoringEngine {
  calculatePHQ9(responses) {
    // Sum individual scores (0-3 each)
    // Return total (0-27) and severity
  }
  
  calculateGAD7(responses) {
    // Sum individual scores (0-3 each)
    // Return total (0-21) and severity
  }
  
  calculateGHQ12(responses) {
    // Sum individual scores (0-3 each)
    // Return total (0-36) and severity
  }
}
```

## Data Models

### Session Data Structure
```javascript
interface SessionData {
  sessionId: string
  userName: string
  startTime: Date
  currentPhase: 'GREETING' | 'TRIAGE' | 'SCREENING' | 'RESULTS'
  selectedTool: 'PHQ9' | 'GAD7' | 'GHQ12' | null
  responses: Array<{
    questionId: string,
    userText: string,
    mappedScore: number,
    timestamp: Date
  }>
  hasPastDiagnosis: boolean
  crisisDetected: boolean
  completed: boolean
}
```

### Screening Tool Definitions
```javascript
interface ScreeningTool {
  id: string
  name: string
  questions: Array<{
    id: string,
    text: string,
    conversationalPrompt: string
  }>
  scoringThresholds: {
    minimal: number,
    mild: number,
    moderate: number,
    severe: number
  }
}
```

### Crisis Response Configuration
```javascript
interface CrisisConfig {
  helplines: Array<{
    name: string,
    number: string,
    description: string,
    country: string
  }>
  emergencyServices: Array<{
    name: string,
    number: string,
    country: string
  }>
  crisisMessage: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Now I need to analyze the acceptance criteria to determine which ones can be tested as properties.
