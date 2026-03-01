# AI Voice Mental Health Assistant 🤖🧠

A voice-enabled assistant designed to provide empathetic support, mental health resources, and simple CBT-style exercises. This repository contains a full-stack prototype (frontend + backend) demonstrating conversational voice interactions, sentiment-aware responses, and resource linking for users seeking mental health support.

Owner: Sayak Pal

Badges
- ✅ Prototype
- 🧪 Manual testing included (see CHECKPOINT_7_MANUAL_TESTING_GUIDE.md)

Table of Contents
- About
- Features
- Quick Start
- Usage Examples
- Project Structure
- Contributing
- Future Plans
- License

About
------

This project aims to create an accessible voice-first mental health assistant that listens, reflects, and guides users to helpful resources. It is not a replacement for professional mental health care. If someone is in crisis, please contact local emergency services or a crisis hotline.

Features
--------

- Voice input and output (microphone + text-to-speech) 🎤🔊
- Sentiment and intent detection (basic sentiment analysis) ❤️‍🩹
- Conversational, empathetic responses with grounding and breathing prompts 🧘‍♂️
- Resource linking (hotlines, articles, nearby services) 🔗
- Modular frontend and backend for easy experimentation 🧩

Quick Start
-----------

1. Clone the repo:

   ```bash
   git clone https://github.com/Sayak-Pal/AI-voice-mental-Health-Assistant.git
   cd AI-voice-mental-Health-Assistant
   ```

2. Backend (Python)

   - See `backend/` for the server implementation. There may be a `setup.py` for installing dependencies.
   - Create a virtual environment, install dependencies, and run the server:

   ```bash
   python -m venv venv
   source venv/bin/activate  # macOS/Linux
   venv\Scripts\activate   # Windows
   pip install -r backend/requirements.txt  # if present
   python backend/app.py  # or the main backend entrypoint
   ```

3. Frontend

   - See `frontend/` for the UI client. Run the development server (example for React/Vue):

   ```bash
   cd frontend
   npm install
   npm start
   ```

Usage Examples
--------------

- Start the app, allow microphone access, and say:
  - "I'm feeling anxious today." → Assistant responds with empathetic reflection and a breathing exercise.
  - "I can't sleep." → Assistant offers grounding techniques and links to sleep hygiene resources.
  - "I feel hopeless." → Assistant provides supportive language and emergency resources if needed.

- Example API call (backend):

```json
POST /api/v1/respond
Content-Type: application/json

{ "text": "I'm really stressed about work" }
```

Example response:

```json
{ "reply": "I'm sorry you're feeling stressed. Take a slow breath with me... (guided breathing)" }
```

Project Structure
-----------------

- backend/ — Python server, APIs, NLP modules
- frontend/ — UI client, voice capture, TTS
- CHECKPOINT_7_MANUAL_TESTING_GUIDE.md — Manual testing instructions
- CHECKPOINT_7_SUMMARY.md — Project summary and checkpoint notes
- setup.py — Installer / packaging helper

Contributing
------------

Contributions are welcome. Please open issues or pull requests. Some ideas:
- Improve sentiment detection accuracy
- Add more languages for TTS and STT
- Integrate with verified crisis hotlines per country

Future Plans 🚀

- Improve NLP: intent classification, context tracking, memory for longer conversations 🧠
- Privacy-first features: on-device processing, encrypted logs 🔒
- Multi-lingual support and accessibility improvements 🌍
- Mobile app editions (iOS/Android) with offline capabilities 📱
- Integrations with certified providers and emergency escalation pathways (with strict consent flows)

Ethics & Safety
---------------

This project is experimental. It is not a medical device. Do not rely on it for urgent crisis situations. Include clear disclaimers in UI and docs.

License
-------

This project is licensed under the MIT License. See LICENSE for details.
