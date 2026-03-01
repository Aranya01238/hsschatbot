class VoiceEngine {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.recognition = null;
        this.isListening = false;
        this.voices = [];
        this.preferredVoice = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphoneSource = null;
        
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        } else {
            this.loadVoices();
        }
        this.checkSupport();
    }

    checkSupport() {
        this.isSupported = {
            recognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
            synthesis: 'speechSynthesis' in window,
            full: ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && 'speechSynthesis' in window
        };
    }

    loadVoices() {
        this.voices = this.synthesis.getVoices();
        this.setVoiceByGender('female'); 
    }

    setVoiceByGender(gender) {
        if (this.voices.length === 0) this.voices = this.synthesis.getVoices();
        const targetGender = gender.toLowerCase();
        const maleKeywords = ['male', 'david', 'daniel', 'mark', 'james'];
        const femaleKeywords = ['female', 'zira', 'samantha', 'susan', 'google us english']; 
        
        const keywords = targetGender === 'male' ? maleKeywords : femaleKeywords;
        const englishVoices = this.voices.filter(v => v.lang.includes('en'));
        
        let foundVoice = englishVoices.find(voice => keywords.some(k => voice.name.toLowerCase().includes(k)));

        if (!foundVoice && targetGender === 'male') {
            foundVoice = englishVoices.find(voice => !femaleKeywords.some(k => voice.name.toLowerCase().includes(k)));
        }
        this.preferredVoice = foundVoice || englishVoices[0] || this.voices[0];
    }

    connectAudioVisualizer(stream, onSpeakingCallback) {
        if (this.audioContext) this.audioContext.close();

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
        
        this.microphoneSource.connect(this.analyser);
        this.analyser.fftSize = 256;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
            if (!this.isListening) return;

            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const average = sum / bufferLength;

            const isSpeaking = average > 10;
            onSpeakingCallback(isSpeaking);

            requestAnimationFrame(checkVolume);
        };
        checkVolume();
    }

    speak(text) {
        if (!this.isSupported.synthesis) return;
        this.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; 
        utterance.pitch = 1;
        if (this.preferredVoice) utterance.voice = this.preferredVoice;

        utterance.onstart = () => { if (window.mentalHealthApp?.avatar) window.mentalHealthApp.avatar.setState('SPEAKING'); };
        utterance.onend = () => { if (window.mentalHealthApp?.avatar) window.mentalHealthApp.avatar.setState('IDLE'); };
        this.synthesis.speak(utterance);
    }

    async startListening() {
        if (!this.isSupported.recognition) throw new Error("Browser not supported (Use Chrome)");
        
        if (this.recognition) this.recognition.abort();

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;
        
        return new Promise((resolve, reject) => {
            try {
                this.recognition.start();
                this.isListening = true;
                this.onListeningStart?.();
            } catch (e) {
                reject("Already started");
            }

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.isListening = false;
                this.onListeningEnd?.();
                this.onSpeechResult?.(transcript);
                resolve(transcript);
            };

            this.recognition.onerror = (event) => {
                this.isListening = false;
                this.onListeningEnd?.();
                let errorMsg = "Unknown Error";
                switch(event.error) {
                    case 'not-allowed': errorMsg = "Permission Denied. Allow Mic."; break;
                    case 'no-speech': errorMsg = "No speech detected."; break;
                    case 'network': errorMsg = "Network error."; break;
                    default: errorMsg = event.error;
                }
                reject(errorMsg);
            };

            this.recognition.onend = () => { 
                this.isListening = false; 
                this.onListeningEnd?.(); 
            };
        });
    }

    stopListening() { 
        if (this.recognition) this.recognition.stop();
        this.isListening = false;
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
    
    onListeningStart = null; onListeningEnd = null; onSpeechResult = null;
}
