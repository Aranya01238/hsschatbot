/**
 * Safety Monitor - Crisis Detection System
 * Real-time monitoring for crisis indicators and trigger words
 */

class SafetyMonitor {
    constructor(customTriggerWords = []) {
        // Crisis trigger words (configurable)
        this.triggerWords = [
            'suicide', 'suicidal', 'kill myself', 'end my life',
            'self-harm', 'hurt myself', 'cut myself', 'harm myself',
            'want to die', 'better off dead', 'no point living',
            'hurt others', 'kill someone', 'harm others', 'end it all',
            'take my own life', 'not worth living', 'kill them'
        ];
        
        // Warning indicators (less severe)
        this.warningWords = [
            'hopeless', 'worthless', 'trapped', 'burden',
            'desperate', 'overwhelmed', 'can\'t cope', 'give up',
            'no way out', 'pointless', 'useless', 'hate myself'
        ];
        
        // Add custom trigger words if provided
        if (Array.isArray(customTriggerWords)) {
            this.triggerWords.push(...customTriggerWords);
        }
        
        this.crisisDetected = false;
        this.crisisTimestamp = null;
        this.overrideCallbacks = [];
    }
    
    /**
     * Check text for crisis indicators
     * @param {string} text - User input text to analyze
     * @returns {string} Crisis level: 'NONE', 'WARNING', 'CRITICAL'
     */
    checkForCrisis(text) {
        if (!text || typeof text !== 'string') {
            return 'NONE';
        }
        
        const normalizedText = text.toLowerCase().trim();
        
        // Check for critical trigger words
        const hasCriticalTrigger = this.triggerWords.some(trigger => 
            normalizedText.includes(trigger.toLowerCase())
        );
        
        if (hasCriticalTrigger) {
            this.crisisDetected = true;
            console.warn('CRISIS DETECTED: Critical trigger words found');
            return 'CRITICAL';
        }
        
        // Check for warning indicators
        const hasWarningIndicator = this.warningWords.some(warning => 
            normalizedText.includes(warning.toLowerCase())
        );
        
        if (hasWarningIndicator) {
            console.warn('WARNING: Concerning language detected');
            return 'WARNING';
        }
        
        return 'NONE';
    }
    
    /**
     * Check if PHQ-9 Question 9 (suicidal ideation) has positive response
     * @param {string} response - User response to analyze
     * @returns {boolean} True if positive response detected
     */
    checkPHQ9Question9(response) {
        if (!response || typeof response !== 'string') {
            return false;
        }
        
        const normalizedResponse = response.toLowerCase().trim();
        
        // Positive indicators for suicidal ideation
        const positiveIndicators = [
            'yes', 'sometimes', 'often', 'nearly every day',
            'several days', 'more than half', 'have thought',
            'been thinking', 'crossed my mind', 'considered'
        ];
        
        // Negative indicators (clear denial)
        const negativeIndicators = [
            'no', 'never', 'not at all', 'haven\'t', 'don\'t',
            'absolutely not', 'definitely not'
        ];
        
        // Check for clear negative responses first
        const hasNegativeIndicator = negativeIndicators.some(negative => 
            normalizedResponse.includes(negative)
        );
        
        if (hasNegativeIndicator && normalizedResponse.length < 20) {
            return false; // Short, clear negative response
        }
        
        // Check for positive indicators
        const hasPositiveIndicator = positiveIndicators.some(positive => 
            normalizedResponse.includes(positive)
        );
        
        if (hasPositiveIndicator) {
            this.crisisDetected = true;
            console.warn('PHQ-9 Q9 POSITIVE: Suicidal ideation detected');
            return true;
        }
        
        return false;
    }
    
    /**
     * Get crisis response message
     * @returns {string} Appropriate crisis response message
     */
    getCrisisResponseMessage() {
        return `I'm very concerned about what you've shared with me. Your safety is the most important thing right now. 

Please reach out for immediate support:
• Crisis Helpline: 988 (available 24/7)
• Emergency Services: 911
• Crisis Text Line: Text HOME to 741741

You don't have to go through this alone. There are people who want to help you, and things can get better. Please reach out to one of these resources right away.`;
    }
    
    /**
     * Get warning response message for concerning but non-critical content
     * @returns {string} Appropriate warning response message
     */
    getWarningResponseMessage() {
        return `I hear that you're going through a difficult time. While I can help with this screening, please remember that professional support is available if you need someone to talk to. 

If you're feeling overwhelmed, consider reaching out to:
• Crisis Helpline: 988
• Your healthcare provider
• A trusted friend or family member

Would you like to continue with the screening, or would you prefer information about mental health resources?`;
    }
    
    /**
     * Register callback for crisis override mechanism
     * @param {Function} callback - Function to call when crisis override is needed
     */
    registerOverrideCallback(callback) {
        if (typeof callback === 'function') {
            this.overrideCallbacks.push(callback);
        }
    }
    
    /**
     * Trigger crisis response override
     * Calls all registered override callbacks and terminates normal flow
     */
    triggerCrisisOverride() {
        this.crisisDetected = true;
        this.crisisTimestamp = new Date();
        
        console.error('CRISIS OVERRIDE TRIGGERED - Terminating normal conversation flow');
        
        // Call all registered override callbacks
        this.overrideCallbacks.forEach(callback => {
            try {
                callback(this.getCrisisResponseMessage());
            } catch (error) {
                console.error('Error in crisis override callback:', error);
            }
        });
    }
    
    /**
     * Process user input and determine if override is needed
     * @param {string} text - User input text
     * @param {boolean} isPhq9Q9 - Whether this is PHQ-9 Question 9
     * @returns {Object} Processing result with override status
     */
    processUserInput(text, isPhq9Q9 = false) {
        const crisisLevel = this.checkForCrisis(text);
        
        // Check PHQ-9 Question 9 specifically
        if (isPhq9Q9 && this.checkPHQ9Question9(text)) {
            this.triggerCrisisOverride();
            return {
                shouldOverride: true,
                level: 'CRITICAL',
                message: this.getCrisisResponseMessage(),
                triggeredBy: 'PHQ9_Q9'
            };
        }
        
        // Handle critical crisis detection
        if (crisisLevel === 'CRITICAL') {
            this.triggerCrisisOverride();
            return {
                shouldOverride: true,
                level: 'CRITICAL',
                message: this.getCrisisResponseMessage(),
                triggeredBy: 'TRIGGER_WORDS'
            };
        }
        
        // Handle warning level (no override, but return warning)
        if (crisisLevel === 'WARNING') {
            return {
                shouldOverride: false,
                level: 'WARNING',
                message: this.getWarningResponseMessage(),
                triggeredBy: 'WARNING_WORDS'
            };
        }
        
        return {
            shouldOverride: false,
            level: 'NONE',
            message: null,
            triggeredBy: null
        };
    }
    
    /**
     * Reset crisis detection state
     */
    reset() {
        this.crisisDetected = false;
        this.crisisTimestamp = null;
    }
    
    /**
     * Check if crisis state is currently active
     * @returns {boolean} True if crisis was detected and is still active
     */
    isCrisisActive() {
        return this.crisisDetected;
    }
    
    /**
     * Get crisis timestamp
     * @returns {Date|null} Timestamp when crisis was detected
     */
    getCrisisTimestamp() {
        return this.crisisTimestamp;
    }
    
    /**
     * Add custom trigger words (for configuration)
     * @param {string[]} words - Array of trigger words to add
     */
    addTriggerWords(words) {
        if (Array.isArray(words)) {
            this.triggerWords.push(...words);
        }
    }
    
    /**
     * Add custom warning words (for configuration)
     * @param {string[]} words - Array of warning words to add
     */
    addWarningWords(words) {
        if (Array.isArray(words)) {
            this.warningWords.push(...words);
        }
    }
}