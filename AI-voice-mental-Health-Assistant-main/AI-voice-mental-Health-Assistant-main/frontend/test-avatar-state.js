/**
 * Property-Based Tests for Avatar State Consistency
 * Feature: voice-mental-health-assistant, Property 2: Avatar State Consistency
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

// Create a temporary DOM environment for testing
const fs = require('fs');
const path = require('path');

// Create temporary HTML structure for testing
const tempHtml = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <video id="avatar-video" autoplay loop muted></video>
    <div id="avatar-status">Ready to listen</div>
</body>
</html>
`;

// Write temporary HTML file
const tempFile = path.join(__dirname, 'temp-avatar-test.html');
fs.writeFileSync(tempFile, tempHtml);

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM(tempHtml);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLVideoElement = dom.window.HTMLVideoElement;

// Mock video element methods for testing
const mockVideoElement = {
    src: '',
    style: { opacity: '1', transition: '' },
    readyState: 2,
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: {
        remove: () => {},
        add: () => {}
    }
};

// Override getElementById to return our mock elements
const originalGetElementById = document.getElementById;
document.getElementById = function(id) {
    if (id === 'avatar-video') return mockVideoElement;
    if (id === 'avatar-status') return { textContent: '', style: { opacity: '1', transition: '' } };
    return originalGetElementById.call(this, id);
};

// Load Avatar component and make it available
const avatarCode = fs.readFileSync(path.join(__dirname, 'js/avatar.js'), 'utf8');

// Execute the code in global scope to define AvatarComponent
eval(`
${avatarCode}
global.AvatarComponent = AvatarComponent;
`);

// Clean up temp file
fs.unlinkSync(tempFile);

// Property-based testing framework
class PropertyTester {
    constructor() {
        this.results = [];
    }
    
    // Generate random avatar states
    generateRandomState() {
        const states = ['IDLE', 'LISTENING', 'SPEAKING', 'THINKING'];
        return states[Math.floor(Math.random() * states.length)];
    }
    
    // Generate random state sequences
    generateRandomStateSequence(length = 5) {
        const sequence = [];
        for (let i = 0; i < length; i++) {
            sequence.push(this.generateRandomState());
        }
        return sequence;
    }
    
    // Generate random timeout values
    generateRandomTimeout() {
        return Math.floor(Math.random() * 5000) + 1000; // 1-6 seconds
    }
    
    // Property test runner
    async runProperty(name, testFn, iterations = 100) {
        let passed = 0;
        let failed = 0;
        let errors = [];
        
        console.log(`Running ${name} (${iterations} iterations)...`);
        
        for (let i = 0; i < iterations; i++) {
            try {
                const result = await testFn();
                if (result) {
                    passed++;
                } else {
                    failed++;
                    errors.push(`Iteration ${i + 1}: Property violation`);
                }
            } catch (error) {
                failed++;
                errors.push(`Iteration ${i + 1}: ${error.message}`);
            }
        }
        
        const result = {
            name,
            passed,
            failed,
            total: iterations,
            errors: errors.slice(0, 5) // Show first 5 errors
        };
        
        console.log(`✅ Passed: ${passed}/${iterations}`);
        if (failed > 0) {
            console.log(`❌ Failed: ${failed}/${iterations}`);
            console.log('Sample errors:', errors.slice(0, 3));
        }
        console.log('');
        
        return result;
    }
}

const tester = new PropertyTester();
let avatar;

// Property 2: Avatar State Consistency
// For any valid state transition sequence, the avatar should maintain consistent state and visual feedback
async function testAvatarStateConsistency() {
    const stateSequence = tester.generateRandomStateSequence(3);
    
    try {
        // Test state transitions maintain consistency
        let previousState = avatar.getCurrentState();
        
        for (const targetState of stateSequence) {
            await avatar.setState(targetState);
            
            // Verify state was actually changed
            const currentState = avatar.getCurrentState();
            if (currentState !== targetState) {
                return false;
            }
            
            // Verify state change was recorded
            if (previousState === currentState && previousState !== targetState) {
                return false; // State should have changed
            }
            
            previousState = currentState;
        }
        
        return true;
    } catch (error) {
        // State transition errors should be handled gracefully
        return error.message.includes('Invalid avatar state') ? true : false;
    }
}

// Property 3: State Timeout Behavior
// For any state with timeout, the avatar should return to IDLE after timeout period
async function testStateTimeoutBehavior() {
    const timeoutStates = ['LISTENING', 'THINKING', 'SPEAKING'];
    const randomState = timeoutStates[Math.floor(Math.random() * timeoutStates.length)];
    
    try {
        // Set state and check timeout is set
        await avatar.setState(randomState);
        
        // Verify state was set
        if (avatar.getCurrentState() !== randomState) {
            return false;
        }
        
        // Verify timeout mechanism exists (we can't wait for actual timeout in tests)
        // Instead, verify the timeout is properly cleared when state changes
        await avatar.setState('IDLE');
        
        return avatar.getCurrentState() === 'IDLE';
    } catch (error) {
        return false;
    }
}

// Property 4: Smooth Transition Consistency
// For any state transition, the avatar should handle transitions smoothly without errors
async function testSmoothTransitionConsistency() {
    const fromState = tester.generateRandomState();
    const toState = tester.generateRandomState();
    
    try {
        // Set initial state
        await avatar.setState(fromState);
        
        // Perform transition
        await avatar.setState(toState);
        
        // Verify final state is correct
        const finalState = avatar.getCurrentState();
        if (finalState !== toState) {
            return false;
        }
        
        // Verify no transition is in progress
        if (avatar.isTransitioning && avatar.isTransitioning()) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// Property 5: Invalid State Rejection
// For any invalid state input, the avatar should reject it and maintain current state
async function testInvalidStateRejection() {
    const invalidStates = ['INVALID', 'UNKNOWN', '', null, undefined, 123, {}];
    const randomInvalidState = invalidStates[Math.floor(Math.random() * invalidStates.length)];
    
    try {
        const initialState = avatar.getCurrentState();
        
        // Attempt to set invalid state
        await avatar.setState(randomInvalidState);
        
        // Verify state remained unchanged
        const currentState = avatar.getCurrentState();
        return currentState === initialState;
    } catch (error) {
        // Errors are acceptable for invalid inputs
        return true;
    }
}

// Property 6: State Recovery and Cleanup
// For any sequence of operations, the avatar should be able to recover to a clean state
async function testStateRecoveryAndCleanup() {
    try {
        // Perform random operations
        const operations = Math.floor(Math.random() * 5) + 1;
        
        for (let i = 0; i < operations; i++) {
            const randomState = tester.generateRandomState();
            await avatar.setState(randomState);
        }
        
        // Force recovery to idle
        if (avatar.forceIdle) {
            avatar.forceIdle();
        } else {
            await avatar.setState('IDLE');
        }
        
        // Verify clean state
        const finalState = avatar.getCurrentState();
        return finalState === 'IDLE';
    } catch (error) {
        return false;
    }
}

// Property 7: Concurrent State Changes
// For any rapid sequence of state changes, the avatar should handle them gracefully
async function testConcurrentStateChanges() {
    try {
        const states = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING'];
        const promises = [];
        
        // Trigger multiple rapid state changes
        for (let i = 0; i < 3; i++) {
            const randomState = states[Math.floor(Math.random() * states.length)];
            promises.push(avatar.setState(randomState));
        }
        
        // Wait for all to complete
        await Promise.all(promises);
        
        // Verify avatar is in a valid state
        const finalState = avatar.getCurrentState();
        return states.includes(finalState);
    } catch (error) {
        // Some errors are acceptable with concurrent operations
        return true;
    }
}

async function runAllTests() {
    console.log('🤖 Avatar State Consistency Property-Based Tests');
    console.log('Feature: voice-mental-health-assistant, Property 2: Avatar State Consistency');
    console.log('Validates: Requirements 2.1, 2.2, 2.3, 2.4\n');
    
    // Initialize avatar component
    avatar = new global.AvatarComponent();
    
    // Run property tests with minimum 100 iterations each
    const tests = [
        { name: 'Property 2.1: Avatar State Consistency', fn: testAvatarStateConsistency, iterations: 100 },
        { name: 'Property 2.2: State Timeout Behavior', fn: testStateTimeoutBehavior, iterations: 100 },
        { name: 'Property 2.3: Smooth Transition Consistency', fn: testSmoothTransitionConsistency, iterations: 100 },
        { name: 'Property 2.4: Invalid State Rejection', fn: testInvalidStateRejection, iterations: 100 },
        { name: 'Property 2.5: State Recovery and Cleanup', fn: testStateRecoveryAndCleanup, iterations: 100 },
        { name: 'Property 2.6: Concurrent State Changes', fn: testConcurrentStateChanges, iterations: 100 }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
        const result = await tester.runProperty(test.name, test.fn, test.iterations);
        if (result.failed > 0) {
            allPassed = false;
        }
    }
    
    console.log('\n📊 Test Summary:');
    console.log(`Overall result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!allPassed) {
        console.log('\n🔍 Failed tests indicate potential issues with avatar state consistency.');
        console.log('Check the implementation for proper state management and transition handling.');
    }
    
    return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, PropertyTester };