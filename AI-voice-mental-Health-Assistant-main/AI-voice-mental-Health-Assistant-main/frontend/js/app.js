class MentalHealthApp {
    constructor() {
        this.voiceEngine = null;
        this.avatar = null;
        this.safetyMonitor = null;
        this.stateMachine = null;
        this.userName = "";
        this.sessionId = null;
        this.apiBaseUrl = 'http://localhost:8000';

        // Element References
        this.micButton = document.getElementById('mic-button');
        this.textInputToggle = document.getElementById('text-input-toggle');
        this.textInputContainer = document.getElementById('text-input-container');
        this.textInput = document.getElementById('text-input');
        this.sendTextButton = document.getElementById('send-text-button');
        this.conversationHistory = document.getElementById('conversation-history');

        // --- NEW VARIABLES ---
        this.chartInstance = null;
        this.chartUpdateInterval = null; // For simulated live data
        this.quotes = [
            "Your mental health is a priority. Your happiness is an essential.",
            "You don’t have to control your thoughts. You just have to stop letting them control you.",
            "There is hope, even when your brain tells you there isn’t.",
            "It is okay to have bad days.",
            "Healing is not linear. Be patient with yourself.",
            "You are strong for getting out of bed today.",
            "Breathe. It’s just a bad day, not a bad life.",
            "You are enough just as you are.",
            "Every day may not be good, but there is something good in every day.",
            "Small steps in the right direction can turn out to be the biggest step of your life.",
            "Recovery is a process. It takes time. It takes patience.",
            "You are allowed to feel messed up and inside out. It doesn't mean you're defective.",
            "Don't believe everything you think.",
            "You are capable of amazing things.",
            "This too shall pass.",
            "Your feelings are valid.",
            "Talk to yourself like you would to someone you love.",
            "Progress is progress, no matter how small.",
            "You are not a burden.",
            "The sun will rise and we will try again."
        ];

        this.initialize();
    }

    async initialize() {
        try {
            this.voiceEngine = new VoiceEngine();
            this.setupVoiceEngineHandlers();
            this.avatar = new AvatarComponent();
            this.safetyMonitor = new SafetyMonitor();
            this.stateMachine = new StateMachine();

            this.checkCompatibility();
            this.setupEventListeners();

            console.log('App initialized');
        } catch (error) {
            this.enableTextFallback();
        }
    }

    async startSession(userName) {
        try {
            this.setUserName(userName);
            const response = await fetch(`${this.apiBaseUrl}/api/session/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_name: userName })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            this.sessionId = data.session_id;
            console.log('Session started:', this.sessionId);
            return true;
        } catch (error) {
            console.error('Failed to start session:', error);
            this.showToast('Could not connect to server. Is it running?', 'error');
            return false;
        }
    }

    setUserName(name) { this.userName = name; }

    setAssistantGender(gender) {
        if (this.avatar) this.avatar.setGender(gender);
        if (this.voiceEngine) this.voiceEngine.setVoiceByGender(gender);
    }

    checkCompatibility() {
        if (this.voiceEngine.isSupported.full) {
            this.micButton.disabled = false;
        } else {
            this.micButton.disabled = true;
            this.showToast('Browser features limited. Use Chrome.', 'error');
            this.enableTextFallback();
        }
    }

    enableTextFallback() {
        this.textInputContainer.style.display = 'flex';
        this.textInputToggle.style.display = 'none';
    }

    // --- NAVIGATION LOGIC ---
    navigateTo(viewId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

        const target = document.getElementById(viewId);
        if (target) target.style.display = viewId === 'chat-view' ? 'block' : 'flex';

        // Toggle Main Nav: Hide it when in stats view (use Back Arrow instead)
        const mainNav = document.getElementById('main-nav');
        if (mainNav) {
            if (viewId === 'stats-view') {
                mainNav.style.display = 'none';
                this.initStatsView();
            } else {
                mainNav.style.display = 'flex';
                this.stopChartSimulation();
            }
        }
    }

    // --- DAILY QUOTE LOGIC ---
    getDailyQuote() {
        const today = new Date();
        const dateSeed = today.getFullYear() * 1000 + (today.getMonth() + 1) * 100 + today.getDate();
        const quoteIndex = dateSeed % this.quotes.length;
        return this.quotes[quoteIndex];
    }

    // --- STATS VIEW INIT ---
    initStatsView() {
        const display = document.getElementById('quote-display');
        if (display) {
            display.style.opacity = 0;
            setTimeout(() => {
                display.innerText = `"${this.getDailyQuote()}"`;
                display.style.opacity = 1;
            }, 300);
        }
        this.renderChart();
    }

    nextQuote() {
        const display = document.getElementById('quote-display');
        const randomQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
        display.style.opacity = 0;
        setTimeout(() => { display.innerText = `"${randomQuote}"`; display.style.opacity = 1; }, 300);
    }

    // --- REAL-TIME CHART ---
    renderChart() {
        const ctx = document.getElementById('mentalHealthChart');
        if (!ctx) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const initialData = [31, 28, 10, 5, 2, 24];

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Anxiety', 'Depression', 'ADHD', 'Bipolar', 'Autism', 'Stress'],
                datasets: [{
                    label: 'Global %',
                    data: initialData,
                    backgroundColor: ['#0F766E', '#2DD4BF', '#FB7185', '#F472B6', '#A78BFA', '#94A3B8'],
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#475569', font: { family: 'Inter' } } },
                    tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toFixed(1)}%` } }
                },
                animation: { duration: 1000, easing: 'easeOutQuart' }
            }
        });

        this.startChartSimulation();
    }

    startChartSimulation() {
        if (this.chartUpdateInterval) clearInterval(this.chartUpdateInterval);
        this.chartUpdateInterval = setInterval(() => {
            if (!this.chartInstance) return;
            const currentData = this.chartInstance.data.datasets[0].data;
            const newData = currentData.map(value => Math.max(0, value + (Math.random() - 0.5) * 2));
            this.chartInstance.data.datasets[0].data = newData;
            this.chartInstance.update();
        }, 3000);
    }

    stopChartSimulation() {
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }
    }

    // --- EXISTING HANDLERS ---
    setupVoiceEngineHandlers() {
        this.voiceEngine.onListeningStart = () => {
            this.micButton.classList.add('listening');
            this.avatar.setState('LISTENING');
        };
        this.voiceEngine.onListeningEnd = () => {
            this.micButton.classList.remove('listening');
            this.micButton.classList.remove('user-speaking');
            this.avatar.setState('THINKING');
        };
        this.voiceEngine.onSpeechResult = (transcript) => this.handleUserInput(transcript, 'speech');
        this.voiceEngine.onSpeechStart = () => this.avatar.setState('SPEAKING');
        this.voiceEngine.onSpeechEnd = () => this.avatar.setState('IDLE');
    }

    setupEventListeners() {
        this.micButton.addEventListener('click', async () => {
            if (this.voiceEngine.isListening) { this.voiceEngine.stopListening(); return; }
            await this.startListening();
        });
        this.textInputToggle.addEventListener('click', () => {
            const isVisible = this.textInputContainer.style.display === 'flex';
            this.textInputContainer.style.display = isVisible ? 'none' : 'flex';
            this.textInputToggle.textContent = isVisible ? 'Prefer to type?' : 'Hide input';
        });
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendTextMessage();
        });
        this.sendTextButton.addEventListener('click', () => this.sendTextMessage());
        document.getElementById('theme-toggle').addEventListener('click', (e) => {
            const body = document.body;
            const isDark = body.getAttribute('data-theme') === 'dark';
            body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            e.target.textContent = isDark ? '☀️' : '🌙';
        });
        document.getElementById('privacy-toggle').addEventListener('click', (e) => {
            document.body.classList.toggle('privacy-mode');
            e.target.textContent = document.body.classList.contains('privacy-mode') ? '🔒' : '👁️';
        });
    }

    async startListening() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.voiceEngine.connectAudioVisualizer(stream, (isSpeaking) => {
                this.micButton.classList.toggle('user-speaking', isSpeaking);
            });
            await this.voiceEngine.startListening();
        } catch (error) {
            console.error(error);
            this.showToast('Microphone access needed.', 'error');
        }
    }

    sendTextMessage() {
        const text = this.textInput.value.trim();
        if (text) {
            this.handleUserInput(text, 'text');
            this.textInput.value = '';
        }
    }

    async handleUserInput(userText, source = 'text') {
        this.addMessageToHistory('user', userText);
        if (this.safetyMonitor.checkForCrisis(userText) === 'CRITICAL') {
            document.getElementById('crisis-modal').style.display = 'flex';
            this.avatar.setState('IDLE');
            return;
        }
        this.avatar.setState('THINKING');
        try {
            setTimeout(async () => {
                const response = await this.processUserMessage(userText, source);
                this.addMessageToHistory('system', response);
                if (this.voiceEngine.isSupported.synthesis) {
                    await this.voiceEngine.speak(response);
                }
            }, 1000);
        } catch (error) {
            this.showToast('Error processing message', 'error');
            this.avatar.setState('IDLE');
        }
    }

    async processUserMessage(userText, source) {
        if (!this.sessionId) {
            return "Connection error: No active session. Please refresh.";
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    user_message: userText
                })
            });

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();

            // Handle crisis detected by backend
            if (data.crisis_detected) {
                document.getElementById('crisis-modal').style.display = 'flex';
                this.avatar.setState('IDLE');
            }

            return data.ai_response;
        } catch (error) {
            console.error('Error processing message:', error);
            this.showToast('Error communicating with AI assistant', 'error');
            return "I'm having trouble connecting right now. Please try again.";
        }
    }

    addMessageToHistory(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${sender}-message`;
        this.conversationHistory.appendChild(messageDiv);
        if (sender === 'user') {
            messageDiv.textContent = message;
        } else {
            let i = 0;
            const typeWriter = () => {
                if (i < message.length) {
                    messageDiv.textContent += message.charAt(i);
                    i++;
                    this.conversationHistory.scrollTop = this.conversationHistory.scrollHeight;
                    setTimeout(typeWriter, 30);
                }
            };
            typeWriter();
        }
        this.conversationHistory.scrollTop = this.conversationHistory.scrollHeight;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>ℹ️</span> <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mentalHealthApp = new MentalHealthApp();
});
