# Checkpoint 7: Core System Integration - Manual Testing Guide

## Overview
This guide provides step-by-step instructions for manually testing the core system integration to verify that voice engine, avatar, API integration, and crisis detection work together properly.

## ✅ Automated Tests Passed
- **Frontend Components**: All required classes and integration points verified
- **Backend Components**: Safety monitor and crisis detection working correctly  
- **Crisis Detection Logic**: All test scenarios passing correctly

## 🧪 Manual Testing Steps

### 1. Frontend Voice Engine Testing

#### Test Browser Compatibility
1. Open `frontend/index.html` in different browsers:
   - Chrome (recommended)
   - Firefox 
   - Safari
   - Edge

2. Check for compatibility warnings:
   - Should show warning if speech recognition not supported
   - Should offer text input fallback

#### Test Microphone Permissions
1. Click the microphone button
2. Verify browser requests microphone permission
3. Grant permission and verify:
   - Button changes to "Listening..." state
   - Avatar changes to LISTENING state
   - Status indicator updates

#### Test Voice Recognition
1. Speak clearly: "Hello, my name is Alex"
2. Verify:
   - Speech is transcribed correctly
   - Text appears in conversation history
   - Avatar transitions: LISTENING → THINKING → SPEAKING

#### Test Speech Synthesis
1. Verify system speaks responses
2. Check voice settings:
   - Clear, natural voice
   - Appropriate speaking rate
   - Proper volume level

### 2. Avatar Component Testing

#### Test State Transitions
1. **IDLE State**: Default state when not active
   - Avatar shows idle animation or fallback
   - Status shows "Ready to listen"

2. **LISTENING State**: When microphone is active
   - Avatar shows listening animation
   - Status shows "Listening..."
   - Visual feedback indicates active listening

3. **THINKING State**: When processing user input
   - Avatar shows thinking/processing animation
   - Status shows "Processing..."
   - User input disabled during this state

4. **SPEAKING State**: When system is responding
   - Avatar shows speaking animation
   - Status shows "Speaking..."
   - Synchronized with speech synthesis

#### Test State Timeouts
1. Start listening and remain silent
2. Verify timeout after ~10 seconds
3. Check return to IDLE state

### 3. Safety Monitor Testing

#### Test Crisis Trigger Words
1. Type or speak: "I want to kill myself"
2. Verify immediate response:
   - Crisis modal appears
   - Emergency resources displayed
   - Normal conversation flow stops
   - Crisis message is spoken

#### Test PHQ-9 Question 9 Detection
1. Navigate to a screening scenario
2. When asked about self-harm thoughts, respond: "Yes, I have been thinking about it"
3. Verify:
   - Crisis response triggers immediately
   - Screening terminates
   - Emergency resources shown

#### Test Warning Level Detection
1. Use concerning but non-critical language: "I feel hopeless and worthless"
2. Verify:
   - Warning message appears
   - Conversation continues (no override)
   - Supportive resources offered

### 4. State Machine Testing

#### Test State Persistence
1. Start a conversation
2. Refresh the page
3. Verify state recovery (if implemented)

#### Test State Transitions
1. Verify proper transitions:
   - IDLE → LISTENING (click microphone)
   - LISTENING → THINKING (speech detected)
   - THINKING → SPEAKING (response ready)
   - SPEAKING → IDLE (response complete)

#### Test Error Recovery
1. Simulate errors (disconnect microphone, etc.)
2. Verify graceful return to IDLE state
3. Check error messages are user-friendly

### 5. API Integration Testing (Requires Gemini API Key)

#### Setup API Key
1. Copy `backend/.env.example` to `backend/.env`
2. Add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

#### Test Backend Server
1. Start backend server:
   ```bash
   cd backend
   python app.py
   ```
2. Verify server starts without errors
3. Check API endpoints respond:
   - `http://localhost:8000/` (should return welcome message)
   - `http://localhost:8000/api/sessions/stats` (should return stats)

#### Test Conversation Flow
1. Open frontend in browser
2. Start conversation: "Hello, I'm feeling depressed"
3. Verify:
   - Backend processes message
   - AI generates appropriate response
   - Response is spoken by frontend
   - Conversation history is maintained

### 6. Complete Integration Flow Testing

#### Test Full Screening Flow
1. **Greeting Phase**:
   - Say: "Hi, my name is Sarah"
   - Verify: System acknowledges and asks about mental health history

2. **Triage Phase**:
   - Say: "I've been feeling very sad and hopeless"
   - Verify: System selects appropriate screening tool (PHQ-9)

3. **Screening Phase**:
   - Answer first few questions naturally
   - Verify: Questions are asked conversationally
   - Check: Responses are mapped to scores correctly

4. **Crisis Detection During Screening**:
   - If asked about self-harm, say: "Yes, nearly every day"
   - Verify: Crisis response overrides normal flow
   - Check: Emergency resources are displayed

#### Test Error Handling
1. **Network Errors**: Disconnect internet during conversation
2. **API Errors**: Use invalid API key
3. **Voice Errors**: Deny microphone permission
4. Verify graceful error handling in all cases

## 🔍 Expected Results

### ✅ Success Criteria
- [ ] Voice recognition works in supported browsers
- [ ] Avatar states transition smoothly
- [ ] Crisis detection triggers immediately for dangerous content
- [ ] Text fallback works when voice fails
- [ ] API integration processes conversations correctly
- [ ] Error handling is graceful and user-friendly
- [ ] Complete conversation flow works end-to-end

### ❌ Common Issues to Watch For
- Microphone permission denied
- Speech recognition not supported in browser
- Avatar animations not loading (fallback should appear)
- Crisis detection not triggering
- API key not configured
- Network connectivity issues

## 🚨 Crisis Detection Test Cases

### Critical Triggers (Should Override)
- "I want to kill myself"
- "I'm going to hurt myself"
- "I want to die"
- "I'm thinking about suicide"
- "I want to hurt others"

### PHQ-9 Q9 Positive Responses (Should Override)
- "Yes, nearly every day"
- "Sometimes I think about it"
- "I have been considering it"
- "More than half the days"

### Warning Level (Should Continue with Warning)
- "I feel hopeless"
- "I'm worthless"
- "I can't cope"
- "I feel trapped"

### Normal Responses (Should Continue Normally)
- "I'm feeling a bit sad"
- "I had a bad day"
- "I'm stressed about work"

## 📋 Troubleshooting

### Voice Engine Issues
- **No microphone access**: Check browser permissions
- **Speech not recognized**: Try Chrome browser, speak clearly
- **No speech output**: Check browser audio settings

### Avatar Issues
- **No animation**: Check if video files exist, fallback should appear
- **States not changing**: Check browser console for errors

### API Issues
- **Server won't start**: Check if Gemini API key is set
- **No responses**: Verify internet connection and API key validity

### Crisis Detection Issues
- **Not triggering**: Check exact trigger words, case sensitivity
- **False positives**: Review trigger word list configuration

## 🎯 Next Steps After Manual Testing

1. **If all tests pass**: Proceed to implement screening questionnaires (Task 8)
2. **If issues found**: Fix identified problems before continuing
3. **Document any browser-specific issues** for user guidance
4. **Consider additional safety measures** based on testing results

## 📞 Emergency Resources for Testing

**Note**: During testing, real emergency resources are displayed. If you or someone you know needs help:

- **US Crisis Lifeline**: 988
- **Emergency Services**: 911
- **Crisis Text Line**: Text HOME to 741741

This is a real mental health screening tool - treat it with appropriate care during testing.