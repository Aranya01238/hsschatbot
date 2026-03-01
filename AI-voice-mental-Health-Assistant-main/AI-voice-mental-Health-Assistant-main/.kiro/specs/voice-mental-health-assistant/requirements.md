# Requirements Document

## Introduction

A voice-based AI mental health screening assistant that provides accessible, stigma-reducing mental health screening through conversational AI. The system uses voice interaction with a robot avatar to administer standardized screening questionnaires (PHQ-9, GAD-7, GHQ-12) while maintaining strict safety protocols and ethical guidelines. This is a non-diagnostic screening tool that refers users to mental health professionals when appropriate.

## Glossary

- **System**: The complete voice-based mental health screening web application
- **Avatar**: The animated robot character that provides visual feedback during conversations
- **Screening_Tool**: Standardized questionnaires (PHQ-9, GAD-7, GHQ-12) used for mental health assessment
- **Crisis_Response**: Emergency protocol activated when suicide risk or self-harm is detected
- **Voice_Engine**: Web Speech API components handling speech recognition and synthesis
- **Safety_Layer**: Real-time monitoring system that intercepts dangerous content
- **Session**: Single user interaction from greeting to completion, stored only in memory
- **Triage**: Initial assessment to determine which screening tool to administer

## Requirements

### Requirement 1: Voice Interaction System

**User Story:** As a user, I want to interact with the system using my voice, so that I can access mental health screening without typing or reading barriers.

#### Acceptance Criteria

1. WHEN a user speaks to the system, THE Voice_Engine SHALL convert speech to text using Web Speech API
2. WHEN the system responds, THE Voice_Engine SHALL convert text to speech with natural voice output
3. WHEN browser compatibility issues occur, THE System SHALL display graceful fallback messages
4. WHEN ambient noise interferes with recognition, THE Voice_Engine SHALL adjust sensitivity automatically
5. WHEN speech recognition fails, THE System SHALL provide alternative input methods

### Requirement 2: Avatar Visual Feedback

**User Story:** As a user, I want visual feedback from an avatar, so that I feel engaged and understand the system's current state.

#### Acceptance Criteria

1. WHEN the system is listening, THE Avatar SHALL display listening animation (nodding/idle loop)
2. WHEN the system is speaking, THE Avatar SHALL display talking animation
3. WHEN the system is processing, THE Avatar SHALL display thinking/loading state
4. WHEN silence timeout occurs, THE Avatar SHALL return to idle state
5. THE Avatar SHALL maintain calming visual design with soft colors

### Requirement 3: Crisis Detection and Response

**User Story:** As a safety monitor, I want immediate crisis intervention, so that users at risk receive appropriate emergency resources.

#### Acceptance Criteria

1. WHEN trigger words are detected (suicide, self-harm, kill myself, hurt others), THE Safety_Layer SHALL immediately stop assessment
2. WHEN PHQ-9 Question 9 receives positive response, THE Safety_Layer SHALL trigger red alert protocol
3. WHEN crisis is detected, THE System SHALL override AI response with emergency helpline information
4. WHEN crisis response activates, THE System SHALL display and speak mandatory crisis message
5. WHEN crisis occurs, THE System SHALL terminate screening and prevent continuation

### Requirement 4: Screening Tool Administration

**User Story:** As a user, I want to complete standardized mental health screenings, so that I can understand my current mental health status.

#### Acceptance Criteria

1. WHEN triage determines screening type, THE System SHALL administer exactly one questionnaire (PHQ-9, GAD-7, or GHQ-12)
2. WHEN asking questions, THE System SHALL present one question at a time in conversational format
3. WHEN user responds, THE System SHALL map natural language to numeric scores
4. WHEN questionnaire completes, THE System SHALL calculate total score using backend logic
5. WHEN results are ready, THE System SHALL explain findings in plain, non-diagnostic language

### Requirement 5: Conversation Flow Management

**User Story:** As a user, I want a structured conversation flow, so that I receive appropriate screening based on my needs.

#### Acceptance Criteria

1. THE System SHALL greet users and collect their preferred name
2. WHEN greeting completes, THE System SHALL ask about past mental health diagnoses
3. WHEN background collected, THE System SHALL ask triage question about primary concern (sadness, anxiety, general stress)
4. WHEN triage completes, THE System SHALL select appropriate screening tool based on response
5. WHEN screening completes, THE System SHALL provide coping strategies or professional referral recommendations

### Requirement 6: Data Privacy and Security

**User Story:** As a user, I want my mental health information protected, so that my privacy is maintained and data is not misused.

#### Acceptance Criteria

1. THE System SHALL store conversation data only in session memory
2. WHEN browser session ends, THE System SHALL automatically clear all user data
3. THE System SHALL not log raw speech audio or transcripts to persistent storage
4. THE System SHALL not include third-party tracking or analytics by default
5. WHEN user data is processed, THE System SHALL handle it only for immediate screening purposes

### Requirement 7: Safety Guardrails and Limitations

**User Story:** As a healthcare safety monitor, I want strict limitations on AI responses, so that users receive appropriate non-diagnostic guidance.

#### Acceptance Criteria

1. THE System SHALL never provide medical diagnoses or diagnostic labels
2. THE System SHALL never prescribe medications or specific treatments
3. THE System SHALL never claim to replace professional mental healthcare
4. THE System SHALL never encourage dependency on the screening tool
5. THE System SHALL display persistent disclaimer about non-diagnostic nature

### Requirement 8: Scoring and Assessment Logic

**User Story:** As a system administrator, I want accurate scoring calculations, so that users receive reliable screening results.

#### Acceptance Criteria

1. WHEN processing responses, THE System SHALL use backend code for all score calculations
2. THE AI SHALL never calculate total scores or determine severity levels
3. WHEN mapping responses, THE AI SHALL only convert natural language to individual question scores
4. THE System SHALL apply standard scoring thresholds for each screening tool
5. WHEN scores indicate concern, THE System SHALL provide appropriate referral guidance

### Requirement 9: Technical Architecture and Performance

**User Story:** As a developer, I want a robust technical foundation, so that the system operates reliably across different environments.

#### Acceptance Criteria

1. THE System SHALL implement frontend state machine with LISTENING/THINKING/SPEAKING states
2. THE System SHALL use session-based memory without requiring database setup
3. THE System SHALL integrate with Gemini API for conversational intelligence
4. THE System SHALL handle browser compatibility gracefully across major browsers
5. THE System SHALL provide clear deployment instructions and environment configuration

### Requirement 10: Emergency Resource Configuration

**User Story:** As a system administrator, I want configurable emergency resources, so that users receive location-appropriate crisis support.

#### Acceptance Criteria

1. THE System SHALL support configurable emergency helpline numbers
2. WHEN crisis detected, THE System SHALL display locally relevant emergency contacts
3. THE System SHALL provide both crisis helplines and emergency services numbers
4. THE System SHALL allow customization of crisis response messages
5. THE System SHALL maintain backup emergency resources if primary contacts unavailable