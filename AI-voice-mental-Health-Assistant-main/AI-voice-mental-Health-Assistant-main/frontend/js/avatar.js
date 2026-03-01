class AvatarComponent {
    constructor() {
        this.statusElement = document.getElementById('avatar-status');
        this.container = document.getElementById('avatar-container');
        this.svgElement = null; 
        this.currentState = 'IDLE';
        
        this.avatars = {
            female: `
                <svg class="human-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="skinF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFE0BD"/><stop offset="100%" stop-color="#EAC096"/></linearGradient>
                        <linearGradient id="hairF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4A3426"/><stop offset="100%" stop-color="#2D1F16"/></linearGradient>
                    </defs>
                    <path d="M40,190 Q100,210 160,190 L160,220 L40,220 Z" fill="#334155"/>
                    <path d="M100,190 L90,210 L110,210 Z" fill="rgba(0,0,0,0.1)"/> 
                    <path d="M85,140 Q100,155 115,140 L115,185 Q100,195 85,185 Z" fill="#EAC096"/>
                    <path d="M50,80 Q30,150 50,180 Q100,190 150,180 Q170,150 150,80 Q140,20 100,20 Q60,20 50,80" fill="url(#hairF)"/>
                    <path d="M60,80 Q60,150 100,150 Q140,150 140,80 Q140,40 100,40 Q60,40 60,80" fill="url(#skinF)"/>
                    <path d="M58,95 Q55,100 58,105" fill="#EAC096"/>
                    <path d="M142,95 Q145,100 142,105" fill="#EAC096"/>
                    <path d="M140,80 Q130,40 100,40 Q50,50 60,110 Q50,70 60,60" fill="url(#hairF)"/>
                    <g id="avatar-eyes">
                        <ellipse cx="82" cy="92" rx="6" ry="3.5" fill="white"/>
                        <ellipse cx="118" cy="92" rx="6" ry="3.5" fill="white"/>
                        <circle cx="82" cy="92" r="2.5" fill="#1e293b"/>
                        <circle cx="118" cy="92" r="2.5" fill="#1e293b"/>
                        <path d="M75,90 Q82,87 89,90" stroke="#4A3426" stroke-width="1.5" fill="none"/>
                        <path d="M111,90 Q118,87 125,90" stroke="#4A3426" stroke-width="1.5" fill="none"/>
                    </g>
                    <path id="avatar-mouth" d="M92,128 Q100,133 108,128" stroke="#C05858" stroke-width="2.5" stroke-linecap="round" fill="transparent"/>
                </svg>`,
            
            male: `
                <svg class="human-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="skinM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F5D0B0"/><stop offset="100%" stop-color="#E0B080"/></linearGradient>
                        <linearGradient id="hairM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2D3748"/><stop offset="100%" stop-color="#1A202C"/></linearGradient>
                    </defs>
                    <path d="M30,195 Q100,225 170,195 L170,220 L30,220 Z" fill="#2C5282"/>
                    <path d="M85,190 L100,215 L115,190" fill="white"/>
                    <path d="M82,145 Q100,155 118,145 L118,190 Q100,195 82,190 Z" fill="#E0B080"/>
                    <path d="M82,150 Q100,170 118,150" fill="rgba(0,0,0,0.1)"/> 
                    <path d="M65,75 Q65,155 100,155 Q135,155 135,75 Q135,40 100,40 Q65,40 65,75" fill="url(#skinM)"/>
                    <path d="M62,95 Q58,100 62,110" fill="#E0B080"/>
                    <path d="M138,95 Q142,100 138,110" fill="#E0B080"/>
                    <path d="M60,80 Q60,30 100,25 Q145,30 140,85 L135,75 Q135,45 100,45 Q65,45 60,80 Z" fill="url(#hairM)"/>
                    <path d="M135,75 L135,95 L130,85 Z" fill="url(#hairM)"/>
                    <path d="M65,75 L65,95 L70,85 Z" fill="url(#hairM)"/>
                    <g id="avatar-eyes">
                        <ellipse cx="85" cy="95" rx="5" ry="3" fill="white"/>
                        <ellipse cx="115" cy="95" rx="5" ry="3" fill="white"/>
                        <circle cx="85" cy="95" r="2" fill="#1e293b"/>
                        <circle cx="115" cy="95" r="2" fill="#1e293b"/>
                        <path d="M80,88 Q85,86 90,88" stroke="#2D3748" stroke-width="2" fill="none"/>
                        <path d="M110,88 Q115,86 120,88" stroke="#2D3748" stroke-width="2" fill="none"/>
                    </g>
                    <path d="M100,105 L98,115 L102,115" stroke="#CCA37A" stroke-width="1.5" fill="none"/>
                    <path id="avatar-mouth" d="M92,135 Q100,140 108,135" stroke="#A94442" stroke-width="2.5" stroke-linecap="round" fill="transparent"/>
                </svg>`
        };
        this.initialize();
    }
    
    initialize() {
        this.setGender('female');
        this.setState('IDLE');
    }

    setGender(gender) {
        if (!this.container) return;
        this.container.innerHTML = `<div class="avatar-core-gradient"></div>` + (this.avatars[gender] || this.avatars['female']);
        this.svgElement = this.container.querySelector('.human-svg');
    }

    setState(newState) {
        if (this.currentState === newState) return;
        this.currentState = newState;
        
        if (this.statusElement) {
            const statusMap = { 'IDLE': 'Ready', 'LISTENING': 'Listening...', 'THINKING': 'Thinking...', 'SPEAKING': 'Speaking...' };
            this.statusElement.textContent = statusMap[newState] || 'Active';
            const dot = document.querySelector('.status-dot');
            if(dot) dot.style.background = (newState === 'SPEAKING' || newState === 'LISTENING') ? '#10B981' : '#cbd5e1'; 
        }
        this.updateVisuals(newState);
    }

    updateVisuals(state) {
        if (!this.svgElement) this.svgElement = document.querySelector('.human-svg');
        if (!this.svgElement) return;
        
        const stage = document.querySelector('.avatar-stage');
        this.svgElement.classList.remove('talking', 'thinking');
        if (stage) stage.classList.remove('speaking');

        switch (state) {
            case 'SPEAKING':
                this.svgElement.classList.add('talking');
                if (stage) stage.classList.add('speaking');
                break;
            case 'THINKING':
                this.svgElement.classList.add('thinking');
                break;
        }
    }
}
