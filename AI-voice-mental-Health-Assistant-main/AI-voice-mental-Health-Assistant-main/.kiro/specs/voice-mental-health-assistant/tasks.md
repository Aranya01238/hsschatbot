# Implementation Plan: Voice-Based AI Mental Health Screening Assistant

## Overview

This implementation plan converts the voice-based AI mental health screening assistant design into discrete coding tasks. The system will be built using Python FastAPI for the backend, vanilla JavaScript for the frontend, and integrate with the Gemini API for conversational intelligence. Each task builds incrementally toward a complete, safe, and ethical mental health screening tool.

## Tasks

- [x] 1. Set up project structure and core configuration
  - Create directory structure for frontend and backend
  - Set up Python virtual environment and dependencies
  - Configure environment variables for API keys and settings
  - Create basic HTML structure with Web Speech API detection
  - _Requirements: 9.2, 9.5_

- [x] 2. Implement crisis detection and safety layer
  - [x] 2.1 Create crisis detection module with trigger word monitoring
    - Implement SafetyMonitor class with configurable trigger words
    - Add real-time text analysis for crisis indicators
    - Create crisis response override mechanism
    - _Requirements: 3.1, 3.3_

  - [x] 2.2 Write property test for crisis detection
    - **Property 3: Crisis Detection and Response**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**

  - [x] 2.3 Implement emergency resource configuration system
    - Create configurable helpline and emergency contact system
    - Implement crisis message customization
    - Add fallback emergency resources
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 2.4 Write unit tests for emergency resource configuration
    - Test helpline configuration loading
    - Test crisis message customization
    - Test fallback resource handling
    - _Requirements: 10.1, 10.2, 10.4_

- [x] 3. Build voice engine and Web Speech API integration
  - [x] 3.1 Implement frontend voice recognition system
    - Create VoiceEngine class with SpeechRecognition integration
    - Add browser compatibility detection and fallbacks
    - Implement timeout handling and error recovery
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 3.2 Implement text-to-speech functionality
    - Add SpeechSynthesis integration with voice configuration
    - Create speech queue management for response delivery
    - Implement speech interruption and control mechanisms
    - _Requirements: 1.2_

  - [x] 3.3 Write property test for voice engine functionality
    - **Property 1: Voice Engine Functionality**
    - **Validates: Requirements 1.1, 1.2**

- [x] 4. Create avatar component and state management
  - [x] 4.1 Implement avatar visual component
    - Create Avatar class with state-based video animations
    - Add smooth transitions between LISTENING/SPEAKING/THINKING/IDLE states
    - Implement timeout handling for state transitions
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Build frontend state machine controller
    - Create StateMachine class with LISTENING/THINKING/SPEAKING states
    - Implement state transition logic and UI coordination
    - Add state persistence and recovery mechanisms
    - _Requirements: 9.1_

  - [x] 4.3 Write property test for avatar state consistency
    - **Property 2: Avatar State Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 5. Implement backend API server and session management
  - [x] 5.1 Create FastAPI server with core endpoints
    - Set up FastAPI application with CORS configuration
    - Implement /api/session/start, /api/conversation, /api/score/calculate endpoints
    - Add request validation and error handling middleware
    - _Requirements: 9.3_

  - [x] 5.2 Build session management system
    - Create SessionManager class with in-memory storage
    - Implement session creation, updates, and automatic cleanup
    - Add session timeout and data privacy controls
    - _Requirements: 6.1, 6.2, 9.2_

  - [x] 5.3 Write property test for data privacy protection
    - **Property 8: Data Privacy Protection**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

- [x] 6. Integrate Gemini API for conversational intelligence
  - [x] 6.1 Create Gemini API client and system instructions
    - Implement GeminiClient class with API integration
    - Create comprehensive system instructions for mental health screening
    - Add safety filters and content moderation settings
    - _Requirements: 9.3_

  - [x] 6.2 Implement conversation flow management
    - Create conversation state tracking (GREETING/TRIAGE/SCREENING/RESULTS)
    - Add natural language processing for user responses
    - Implement response mapping to questionnaire scores
    - _Requirements: 5.1, 5.2, 5.3, 4.3_

  - [x] 6.3 Write property test for non-diagnostic communication
    - **Property 6: Non-Diagnostic Communication**
    - **Validates: Requirements 4.5, 7.1, 7.2, 7.3, 7.4**

- [x] 7. Checkpoint - Core system integration test
  - Ensure voice engine, avatar, and API integration work together
  - Test basic conversation flow from greeting to triage
  - Verify crisis detection interrupts conversation appropriately
  - Ask the user if questions arise

- [ ] 8. Implement screening questionnaires and scoring logic
  - [ ] 8.1 Create screening tool definitions and questions
    - Define PHQ-9, GAD-7, and GHQ-12 questionnaire structures
    - Implement conversational question prompts for each tool
    - Add question sequencing and progress tracking
    - _Requirements: 4.1, 4.2_

  - [ ] 8.2 Build backend scoring engine
    - Create ScoringEngine class with standard threshold calculations
    - Implement PHQ-9, GAD-7, and GHQ-12 scoring algorithms
    - Add severity level determination and result interpretation
    - _Requirements: 8.1, 8.4_

  - [ ] 8.3 Write property test for response processing and scoring
    - **Property 5: Response Processing and Scoring**
    - **Validates: Requirements 4.3, 4.4**

  - [ ] 8.4 Write property test for AI role separation
    - **Property 9: AI Role Separation**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ] 8.5 Write property test for standard scoring accuracy
    - **Property 10: Standard Scoring Accuracy**
    - **Validates: Requirements 8.4, 8.5**

- [ ] 9. Implement triage logic and questionnaire selection
  - [ ] 9.1 Create triage assessment system
    - Implement triage question processing for sadness/anxiety/stress
    - Add questionnaire selection logic based on user responses
    - Create single questionnaire enforcement mechanism
    - _Requirements: 5.4, 4.1_

  - [ ] 9.2 Build recommendation and referral system
    - Implement coping strategy suggestions based on scores
    - Add professional referral recommendations for concerning scores
    - Create non-diagnostic result explanations
    - _Requirements: 5.5, 4.5_

  - [ ] 9.3 Write property test for triage and recommendation logic
    - **Property 7: Triage and Recommendation Logic**
    - **Validates: Requirements 5.4, 5.5**

- [ ] 10. Implement PHQ-9 Question 9 special handling
  - [ ] 10.1 Add PHQ-9 Question 9 crisis detection
    - Implement special monitoring for suicidal ideation question
    - Add immediate red alert protocol for positive responses
    - Create automatic screening termination for Question 9 triggers
    - _Requirements: 3.2_

  - [ ] 10.2 Write unit test for PHQ-9 Question 9 handling
    - Test positive response detection and crisis activation
    - Test screening termination after Question 9 trigger
    - Test emergency resource display for Question 9 scenarios
    - _Requirements: 3.2_

- [ ] 11. Create frontend UI and user experience
  - [ ] 11.1 Build main interface with avatar and controls
    - Create calming visual design with soft color scheme
    - Implement persistent disclaimer display
    - Add microphone permission handling and status indicators
    - _Requirements: 2.5, 7.5_

  - [ ] 11.2 Implement conversation display and interaction
    - Create conversation history display with accessibility features
    - Add visual feedback for system processing states
    - Implement alternative input methods for voice failures
    - _Requirements: 1.5, 2.3_

  - [ ] 11.3 Write unit tests for UI components
    - Test disclaimer persistence across all states
    - Test microphone permission handling
    - Test alternative input method activation
    - _Requirements: 7.5, 1.5_

- [ ] 12. Add comprehensive error handling and recovery
  - [ ] 12.1 Implement API error handling and retry logic
    - Add Gemini API failure recovery with exponential backoff
    - Implement network error detection and user notification
    - Create graceful degradation for API unavailability
    - _Requirements: 9.4_

  - [ ] 12.2 Add browser compatibility and fallback systems
    - Implement Web Speech API feature detection
    - Create text-based fallbacks for voice functionality
    - Add cross-browser compatibility handling
    - _Requirements: 1.3, 9.4_

- [ ] 13. Final integration and comprehensive testing
  - [ ] 13.1 Wire all components together
    - Connect frontend state machine to backend API
    - Integrate crisis detection across all conversation phases
    - Ensure data privacy compliance throughout user journey
    - _Requirements: 6.5, 3.5_

  - [ ] 13.2 Write integration tests for complete user flows
    - Test complete screening flows for each questionnaire type
    - Test crisis detection and response across all conversation phases
    - Test session management and data cleanup
    - _Requirements: 4.1, 3.1, 6.2_

- [ ] 14. Final checkpoint - Complete system validation
  - Ensure all tests pass and system operates safely
  - Verify crisis detection works across all scenarios
  - Confirm data privacy and ethical guidelines are maintained
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive development from the start
- Each task references specific requirements for traceability
- Crisis detection and safety features are prioritized throughout development
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All scoring calculations must be performed in backend, never by AI
- System must maintain non-diagnostic nature and ethical guidelines at all times