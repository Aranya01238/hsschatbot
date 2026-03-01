/**
 * State Machine Controller
 * Manages application state transitions and UI coordination
 */

class StateMachine {
    constructor() {
        this.states = {
            LISTENING: 'LISTENING',
            THINKING: 'THINKING', 
            SPEAKING: 'SPEAKING',
            IDLE: 'IDLE',
            CRISIS: 'CRISIS'
        };
        
        this.currentState = this.states.IDLE;
        this.previousState = null;
        this.stateHistory = [];
        this.persistenceKey = 'mental-health-app-state';
        
        // State transition rules
        this.allowedTransitions = {
            IDLE: ['LISTENING', 'SPEAKING', 'CRISIS'],
            LISTENING: ['THINKING', 'IDLE', 'CRISIS'],
            THINKING: ['SPEAKING', 'IDLE', 'CRISIS'],
            SPEAKING: ['IDLE', 'LISTENING', 'CRISIS'],
            CRISIS: ['IDLE'] // Crisis can only return to idle
        };
        
        // State recovery timeouts (in milliseconds)
        this.recoveryTimeouts = {
            LISTENING: 30000, // 30 seconds
            THINKING: 15000,  // 15 seconds
            SPEAKING: 60000   // 60 seconds
        };
        
        this.currentRecoveryTimeout = null;
        
        this.initialize();
    }
    
    /**
     * Initialize state machine
     */
    initialize() {
        // Try to recover previous state
        this.recoverState();
        
        // Set up page visibility change handler for state persistence
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.persistState();
            }
        });
        
        // Set up beforeunload handler for cleanup
        window.addEventListener('beforeunload', () => {
            this.persistState();
        });
        
        console.log('State machine initialized');
    }
    
    /**
     * Transition to new state
     * @param {string} newState - Target state to transition to
     * @param {Object} context - Optional context data for the transition
     * @returns {boolean} True if transition was successful
     */
    setState(newState, context = {}) {
        // Validate state
        if (!Object.values(this.states).includes(newState)) {
            console.error(`Invalid state: ${newState}`);
            return false;
        }
        
        // Check if transition is allowed
        if (!this.isTransitionAllowed(this.currentState, newState)) {
            console.warn(`Transition from ${this.currentState} to ${newState} not allowed`);
            return false;
        }
        
        // Clear any existing recovery timeout
        this.clearRecoveryTimeout();
        
        // Store previous state
        this.previousState = this.currentState;
        
        // Update state history
        this.stateHistory.push({
            from: this.currentState,
            to: newState,
            timestamp: new Date(),
            context: context
        });
        
        // Perform state transition
        this.currentState = newState;
        
        // Execute state-specific actions
        this.executeStateActions(newState, context);
        
        // Set up recovery timeout for non-idle states
        this.setRecoveryTimeout(newState);
        
        // Persist state for recovery
        this.persistState();
        
        // Notify listeners
        this.onStateChange?.(newState, this.previousState, context);
        
        console.log(`State transition: ${this.previousState} → ${newState}`);
        return true;
    }
    
    /**
     * Check if transition between states is allowed
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is allowed
     */
    isTransitionAllowed(fromState, toState) {
        if (fromState === toState) {
            return true; // Same state is always allowed
        }
        
        const allowedFromCurrent = this.allowedTransitions[fromState];
        return allowedFromCurrent && allowedFromCurrent.includes(toState);
    }
    
    /**
     * Execute actions specific to each state
     * @param {string} state - Current state
     * @param {Object} context - State context data
     */
    executeStateActions(state, context) {
        switch (state) {
            case this.states.IDLE:
                this.handleIdleState(context);
                break;
                
            case this.states.LISTENING:
                this.handleListeningState(context);
                break;
                
            case this.states.THINKING:
                this.handleThinkingState(context);
                break;
                
            case this.states.SPEAKING:
                this.handleSpeakingState(context);
                break;
                
            case this.states.CRISIS:
                this.handleCrisisState(context);
                break;
        }
    }
    
    /**
     * Handle IDLE state actions
     */
    handleIdleState(context) {
        // Update UI to idle state
        this.updateUIForState('IDLE');
        
        // Enable user interaction
        this.enableUserInput();
    }
    
    /**
     * Handle LISTENING state actions
     */
    handleListeningState(context) {
        // Update UI to listening state
        this.updateUIForState('LISTENING');
        
        // Disable other inputs while listening
        this.disableTextInput();
    }
    
    /**
     * Handle THINKING state actions
     */
    handleThinkingState(context) {
        // Update UI to thinking state
        this.updateUIForState('THINKING');
        
        // Disable all user inputs while processing
        this.disableUserInput();
    }
    
    /**
     * Handle SPEAKING state actions
     */
    handleSpeakingState(context) {
        // Update UI to speaking state
        this.updateUIForState('SPEAKING');
        
        // Disable user input while system is speaking
        this.disableUserInput();
    }
    
    /**
     * Handle CRISIS state actions
     */
    handleCrisisState(context) {
        // Update UI to crisis state
        this.updateUIForState('CRISIS');
        
        // Disable normal interactions
        this.disableUserInput();
        
        // Show crisis resources
        this.showCrisisResources();
    }
    
    /**
     * Update UI elements based on current state
     * @param {string} state - Current state
     */
    updateUIForState(state) {
        const body = document.body;
        
        // Remove all state classes
        body.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-crisis');
        
        // Add current state class
        body.classList.add(`state-${state.toLowerCase()}`);
    }
    
    /**
     * Enable user input controls
     */
    enableUserInput() {
        const micButton = document.getElementById('mic-button');
        const textInput = document.getElementById('text-input');
        const sendButton = document.getElementById('send-text-button');
        
        if (micButton) micButton.disabled = false;
        if (textInput) textInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
    
    /**
     * Disable user input controls
     */
    disableUserInput() {
        const micButton = document.getElementById('mic-button');
        const textInput = document.getElementById('text-input');
        const sendButton = document.getElementById('send-text-button');
        
        if (micButton) micButton.disabled = true;
        if (textInput) textInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
    }
    
    /**
     * Disable text input only
     */
    disableTextInput() {
        const textInput = document.getElementById('text-input');
        const sendButton = document.getElementById('send-text-button');
        
        if (textInput) textInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
    }
    
    /**
     * Show crisis resources
     */
    showCrisisResources() {
        const crisisModal = document.getElementById('crisis-modal');
        if (crisisModal) {
            crisisModal.style.display = 'flex';
        }
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Get previous state
     * @returns {string} Previous state
     */
    getPreviousState() {
        return this.previousState;
    }
    
    /**
     * Get state history
     * @returns {Array} Array of state transitions
     */
    getStateHistory() {
        return [...this.stateHistory];
    }
    
    /**
     * Reset state machine to initial state
     */
    reset() {
        this.clearRecoveryTimeout();
        this.currentState = this.states.IDLE;
        this.previousState = null;
        this.stateHistory = [];
        this.updateUIForState('IDLE');
        this.enableUserInput();
        this.clearPersistedState();
    }
    
    /**
     * Persist current state to sessionStorage for recovery
     */
    persistState() {
        try {
            const stateData = {
                currentState: this.currentState,
                previousState: this.previousState,
                timestamp: new Date().toISOString(),
                stateHistory: this.stateHistory.slice(-10) // Keep last 10 transitions
            };
            
            sessionStorage.setItem(this.persistenceKey, JSON.stringify(stateData));
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    }
    
    /**
     * Recover state from sessionStorage
     */
    recoverState() {
        try {
            const persistedData = sessionStorage.getItem(this.persistenceKey);
            if (!persistedData) {
                this.setState(this.states.IDLE);
                return;
            }
            
            const stateData = JSON.parse(persistedData);
            const persistedTime = new Date(stateData.timestamp);
            const now = new Date();
            const timeDiff = now - persistedTime;
            
            // Only recover if less than 5 minutes have passed
            if (timeDiff < 5 * 60 * 1000) {
                this.currentState = stateData.currentState;
                this.previousState = stateData.previousState;
                this.stateHistory = stateData.stateHistory || [];
                
                // If recovered state is not IDLE or CRISIS, transition to IDLE for safety
                if (this.currentState !== this.states.IDLE && this.currentState !== this.states.CRISIS) {
                    console.log(`Recovering from ${this.currentState}, transitioning to IDLE for safety`);
                    this.setState(this.states.IDLE, { recovered: true });
                } else {
                    this.executeStateActions(this.currentState, { recovered: true });
                }
                
                console.log(`State recovered: ${this.currentState}`);
            } else {
                console.log('Persisted state too old, starting fresh');
                this.setState(this.states.IDLE);
            }
        } catch (error) {
            console.warn('Failed to recover state:', error);
            this.setState(this.states.IDLE);
        }
    }
    
    /**
     * Clear persisted state
     */
    clearPersistedState() {
        try {
            sessionStorage.removeItem(this.persistenceKey);
        } catch (error) {
            console.warn('Failed to clear persisted state:', error);
        }
    }
    
    /**
     * Set recovery timeout for automatic state recovery
     */
    setRecoveryTimeout(state) {
        const timeout = this.recoveryTimeouts[state];
        if (timeout) {
            this.currentRecoveryTimeout = setTimeout(() => {
                console.log(`Recovery timeout reached for ${state}, returning to IDLE`);
                this.setState(this.states.IDLE, { recoveryTimeout: true });
                this.onRecoveryTimeout?.(state);
            }, timeout);
        }
    }
    
    /**
     * Clear current recovery timeout
     */
    clearRecoveryTimeout() {
        if (this.currentRecoveryTimeout) {
            clearTimeout(this.currentRecoveryTimeout);
            this.currentRecoveryTimeout = null;
        }
    }
    
    /**
     * Get state machine health status
     */
    getHealthStatus() {
        return {
            currentState: this.currentState,
            previousState: this.previousState,
            hasRecoveryTimeout: !!this.currentRecoveryTimeout,
            stateHistoryLength: this.stateHistory.length,
            lastTransition: this.stateHistory[this.stateHistory.length - 1]
        };
    }
    
    // Event handler (to be set by consumers)
    onStateChange = null;
    onRecoveryTimeout = null;
}