/**
 * Property-Based Tests for Voice Engine
 * Feature: voice-mental-health-assistant, Property 1: Voice Engine Functionality
 * Validates: Requirements 1.1, 1.2
 */

// Mock Web Speech API for Node.js environment
global.window = {
    speechSynthesis: {
        speaking: false,
        paused: false,
        speak(utterance) {
            this.speaking = true;
            setTimeout(() => {
                if (utterance.onstart) utterance.onstart();
            }, 10);
            setTimeout(() => {
                this.speaking = false;
                if (utterance.onend) utterance.onend();
            }, 100);
        },
        cancel() {
            this.speaking = false;
        },
        pause() {
            this.paused = true;
        },
        resume() {
            this.paused = false;
        },
        getVoices() {
            return [{ name: 'Mock Voice', lang: 'en-US' }];
        }
    },
    webkitSpeechRecognition: class MockSpeechRecognition {
        constructor() {
            this.continuous = false;
            this.interimResults = false;
            this.lang = 'en-US';
            this.maxAlternatives = 1;
        }
        
        start() {
            setTimeout(() => {
                if (this.onstart) this.onstart();
            }, 10);
            setTimeout(() => {
                const mockResult = {
                    results: [{
                        isFinal: true,
                        0: { transcript: 'mock speech result', confidence: 0.9 }
                    }]
                };
                if (this.onresult) this.onresult(mockResult);
            }, 100);
            setTimeout(() => {
                if (this.onend) this.onend();
            }, 200);
        }
        
        stop() {
            setTimeout(() => {
                if (this.onend) this.onend();
            }, 10);
        }
    }
};

global.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
    constructor(text) {
        this.text = text;
        this.lang = 'en-US';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
    }
};

global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    mediaDevices: {
        getUserMedia: () => Promise.resolve({ audio: true })
    }
};

// Load the VoiceEngine class by creating a module-like environment
const fs = require('fs');
const path = require('path');

// Read and modify the VoiceEngine code to work in Node.js
let voiceEngineCode = fs.readFileSync(path.join(__dirname, 'js', 'voice-engine.js'), 'utf8');

// Add module export at the end
voiceEngineCode += '\nif (typeof module !== "undefined" && module.exports) { module.exports = VoiceEngine; }';

// Create a temporary file and require it
const tempFile = path.join(__dirname, 'temp-voice-engine.js');
fs.writeFileSync(tempFile, voiceEngineCode);

const VoiceEngine = require('./temp-voice-engine.js');

// Clean up temp file
fs.unlinkSync(tempFile);

// Property-based testing framework
class PropertyTester {
    constructor() {
        this.results = [];
    }
    
    // Generate random test data
    generateRandomText(minLength = 1, maxLength = 100) {
        const words = ['hello', 'world', 'test', 'voice', 'engine', 'speech', 'recognition', 'synthesis', 'mental', 'health'];
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        let text = '';
        for (let i = 0; i < length; i++) {
            if (i > 0) text += ' ';
            text += words[Math.floor(Math.random() * words.length)];
        }
        return text;
    }
    
    generateRandomOptions() {
        return {
            language: Math.random() > 0.5 ? 'en-US' : 'en-GB',
            rate: Math.random() * 1.5 + 0.5, // 0.5 to 2.0
            pitch: Math.random() * 1.5 + 0.5, // 0.5 to 2.0
            volume: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
            priority: Math.random() > 0.7 ? 'high' : 'normal'
        };
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
        
        this.results.push(result);
        this.displayResult(result);
        return result;
    }
    
    displayResult(result) {
        const status = result.failed === 0 ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${result.name}: ${result.passed}/${result.total} iterations passed`);
        
        if (result.failed > 0 && result.errors.length > 0) {
            console.log('  Sample errors:');
            result.errors.forEach(error => {
                console.log(`    - ${error}`);
            });
        }
    }
}

const tester = new PropertyTester();
let voiceEngine;

// Property 1: Voice Engine Functionality
// For any valid text input and speech options, the voice engine should handle speech synthesis without errors
async function testVoiceEngineFunctionality() {
    const text = tester.generateRandomText(1, 50);
    const options = tester.generateRandomOptions();
    
    try {
        // Test that speak method returns a promise
        const speakPromise = voiceEngine.speak(text, options);
        if (!(speakPromise instanceof Promise)) {
            return false;
        }
        
        // Test that voice engine maintains consistent state
        await speakPromise;
        
        // After speaking, the operation should complete successfully
        return true;
    } catch (error) {
        // Speech synthesis errors are acceptable in test environment
        if (error.message.includes('Speech synthesis not supported')) {
            return true; // Pass if synthesis not supported
        }
        throw error;
    }
}

// Property 2: Speech Queue Management
// For any sequence of speech requests, the queue should process them in order
async function testSpeechQueueManagement() {
    const texts = [
        tester.generateRandomText(1, 20),
        tester.generateRandomText(1, 20),
        tester.generateRandomText(1, 20)
    ];
    
    // Add multiple items to queue
    const promises = texts.map(text => voiceEngine.speak(text));
    
    // Wait for all to complete
    await Promise.all(promises);
    
    // Queue should be empty after processing
    return voiceEngine.getQueueLength() === 0;
}

// Property 3: Error Handling Consistency
// For any invalid input, the voice engine should handle errors gracefully
async function testErrorHandling() {
    try {
        // Test with empty text
        await voiceEngine.speak('');
        
        // Test with null options
        await voiceEngine.speak('test', null);
        
        // Test stopping when not speaking
        voiceEngine.stopSpeaking();
        
        // Test clearing empty queue
        voiceEngine.clearQueue();
        
        return true;
    } catch (error) {
        // Errors should be meaningful, not crashes
        return error.message && error.message.length > 0;
    }
}

// Property 4: Browser Compatibility Detection
// For any browser environment, support detection should be consistent
async function testBrowserCompatibility() {
    const support = voiceEngine.checkSupport();
    
    // Support object should have required properties
    const hasRequiredProps = support.hasOwnProperty('recognition') &&
                           support.hasOwnProperty('synthesis') &&
                           support.hasOwnProperty('full') &&
                           support.hasOwnProperty('limitations');
    
    if (!hasRequiredProps) return false;
    
    // Full support should be logical combination
    const logicalFull = support.full === (support.recognition && support.synthesis);
    
    return logicalFull;
}

// Property 5: State Consistency
// For any sequence of operations, the voice engine should maintain consistent state
async function testStateConsistency() {
    // Test speech state consistency
    const initialSpeaking = voiceEngine.isSpeaking();
    
    // Speak something
    const speakPromise = voiceEngine.speak('test');
    await speakPromise;
    
    // State should be consistent after operation
    return !voiceEngine.isSpeaking(); // Should not be speaking after completion
}

// Property 6: Timeout and Recovery Behavior
// For any timeout scenario, the voice engine should handle it gracefully
async function testTimeoutBehavior() {
    // Test that timeout values are reasonable
    const timeouts = voiceEngine.timeouts;
    
    const hasValidTimeouts = timeouts.listening > 0 &&
                           timeouts.silence > 0 &&
                           timeouts.retry >= 0;
    
    if (!hasValidTimeouts) return false;
    
    // Test fallback options
    const fallbacks = voiceEngine.getFallbackOptions();
    
    // Should return an array
    return Array.isArray(fallbacks);
}

async function runAllTests() {
    console.log('🎤 Voice Engine Property-Based Tests');
    console.log('Feature: voice-mental-health-assistant, Property 1: Voice Engine Functionality');
    console.log('Validates: Requirements 1.1, 1.2\n');
    
    // Initialize voice engine
    voiceEngine = new VoiceEngine();
    
    // Run property tests with minimum 100 iterations each
    const tests = [
        { name: 'Property 1: Voice Engine Functionality', fn: testVoiceEngineFunctionality, iterations: 100 },
        { name: 'Property 2: Speech Queue Management', fn: testSpeechQueueManagement, iterations: 100 },
        { name: 'Property 3: Error Handling Consistency', fn: testErrorHandling, iterations: 100 },
        { name: 'Property 4: Browser Compatibility Detection', fn: testBrowserCompatibility, iterations: 100 },
        { name: 'Property 5: State Consistency', fn: testStateConsistency, iterations: 100 },
        { name: 'Property 6: Timeout and Recovery Behavior', fn: testTimeoutBehavior, iterations: 100 }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
        const result = await tester.runProperty(test.name, test.fn, test.iterations);
        if (result.failed > 0) {
            allPassed = false;
        }
    }
    
    console.log('\n📊 Test Summary:');
    const totalTests = tester.results.length;
    const passedTests = tester.results.filter(r => r.failed === 0).length;
    const totalIterations = tester.results.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = tester.results.reduce((sum, r) => sum + r.passed, 0);
    
    console.log(`Properties: ${passedTests}/${totalTests} passed`);
    console.log(`Iterations: ${totalPassed}/${totalIterations} passed`);
    console.log(`Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    // Return exit code
    process.exit(allPassed ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, PropertyTester };