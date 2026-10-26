# ZentroMart VoiceOps — AI-Powered Voice Customer Support

ZentroMart VoiceOps is an AI customer support platform combining speech recognition, policy-grounded Retrieval Augmented Generation (RAG), and speech synthesis to deliver a voice-first support assistant.

Customers can speak their support inquiries (e.g., return rules, damaged goods, membership perks, order policies) through their browser microphone, and receive a spoken audio answer grounded in the ZentroMart knowledge base.

---

## 1. System Architecture

```text
               Browser (React + Vite)
                         │
             1. Record Voice (MediaRecorder)
                         ▼
        FastAPI Backend (`POST /voice/ask/audio`)
                         │
            2. Gnani STT (Speech to Text)
                         ▼
           3. TF-IDF Knowledge Retrieval (RAG)
                         ▼
              4. Groq LLM (Grounded Answer)
                         ▼
            5. Gnani TTS (WAV Audio Synthesis)
                         ▼
       6. Save to `generated_audio/response_<id>.wav`
                         │
                         ▼
         Frontend Displays Transcript, Answer,
       Plays Audio Response & Offers WAV Download
```

---

## 2. Environment Configuration

Create a `.env` file in the project root (alongside `src/` and `data/`):

```env
GROQ_API_KEY=your_groq_api_key_here
GNANI_API_KEY=your_gnani_api_key_here
```

> **Note:** Never commit `.env` to Git. The `.gitignore` file already excludes `.env`.

---

## 3. Quick Start Instructions

### Terminal 1: Start the Backend

In your project root, open PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn src.main:app --reload
```

The FastAPI backend will start at:
* **API Base:** `http://127.0.0.1:8000`
* **Interactive Swagger Documentation:** `http://127.0.0.1:8000/docs`
* **Health Check:** `http://127.0.0.1:8000/health`

### Terminal 2: Start the Frontend

Open a second PowerShell terminal window:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will start and normally opens at:
* `http://localhost:5173`

---

## 4. How to Use the Customer Support Frontend

Open `http://localhost:5173` in Google Chrome, Microsoft Edge, or Mozilla Firefox.

The header displays **ZentroMart Customer Support** and a navigation switcher between **Voice Assistant** and **Text Chat**, along with a real-time **Ready** status indicator.

### A. Voice Assistant Mode
1. Click the **Microphone** button.
2. When prompted by your browser, grant microphone permission.
3. Speak your customer support question clearly. The live audio level meter reflects actual microphone input.
4. Click **"Finish & Get Answer"**.
5. The assistant transcribes your speech via Gnani STT, retrieves grounded store policies, formulates an answer with Groq, and generates speech with Gnani TTS.
6. The interface displays your question, the policy-grounded answer, source policy tags, an audio player, and a **"Download audio (.wav)"** button.
7. Click **"Ask another question"** to start a new voice query.

### B. Text Chat Mode
1. Click the **Text Chat** tab in the header.
2. You will be greeted by the welcome message: *"Hi! Welcome to ZentroMart. How can I help you today?"*
3. You can click any suggested prompt chip (e.g. *"Can I return a damaged product?"*, *"Where is my order?"*, *"How do refunds work?"*) or type your own question in the input area.
4. Press **Enter** to send (or **Shift + Enter** for a new line) or click the **Send** button.
5. The assistant answers your query grounded in the knowledge base, displaying discreet policy source tags.
6. **On-Demand Audio Playback:** Click the **"Listen"** button on any assistant message to synthesize and play the spoken audio response via Gnani TTS on demand.
7. Click **"New chat"** at any time to start a fresh conversation.

---

## 5. Storage of Generated Audio

All generated response audio files are saved in:

```text
generated_audio/
├── .gitkeep
├── response_7dc68f768fc6493db93ba39322497cbe.wav
└── response_<unique-uuid>.wav
```

### Safety and Access
* Served via: `GET /voice/audio/{filename}`
* Filename validation rejects directory traversal (`..`) and only allows safe filenames within `generated_audio/`.
* Responses are preserved for playback and download throughout the user session.
* Audio files are excluded from Git commits via `.gitignore` while keeping the folder intact via `.gitkeep`.

### Cleaning Up Generated Audio
To manually remove old audio files from PowerShell:

```powershell
Get-ChildItem -Path generated_audio -Filter "*.wav" | Remove-Item -Force
```

---

## 6. Testing the API in Swagger

Open `http://127.0.0.1:8000/docs` in your browser to interact with all endpoints:

1. **`GET /health`**: Returns `{"status": "healthy"}`.
2. **`GET /chat` & `POST /chat`**: Submit question text to receive an AI response grounded in the knowledge base with sources.
3. **`POST /voice/speak`**: Enter text (e.g. `{"text": "Hello ZentroMart", "language": "en-IN"}`) to stream WAV audio.
4. **`POST /voice/transcribe`**: Upload an audio file (`.wav`, `.m4a`, `.webm`, etc.) and receive `{ "transcript": "...", "language": "en-IN" }`.
5. **`POST /voice/ask`**: Upload an audio file to receive `{ "transcript": "...", "answer": "...", "sources": [...] }` without generating TTS.
6. **`POST /voice/ask/audio`**: Main voice pipeline endpoint. Uploads audio, executes full STT -> RAG -> Groq -> TTS, saves the response in `generated_audio/`, and returns transcript, answer, sources, `audio_url`, and `audio_filename`.
7. **`GET /voice/audio/{filename}`**: Fetches the saved WAV file.
8. **`POST /orders/{order_id}/verify`**: Verifies order ownership using email.
8. **`GET /knowledge/search`**: Searches the Markdown knowledge base.
9. **`GET /chat`**: Text-based query endpoint grounded in the knowledge base.

---

## 7. Running Dataset Validation

To verify the CSV datasets, schemas, and policy documents:

```powershell
.\.venv\Scripts\python.exe validate_dataset.py
```

Expected result:
```text
PASS — all 9 CSVs, 21 KB documents, primary/foreign keys, order math,
       practice evidence, verification gates and company naming validated.
       1,000 orders | 1,783 items | 244 logs | 52 questions | 23 conversations
```

---

## 8. Common Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Microphone access denied** | Browser permissions blocked | Click the lock icon in the browser address bar next to `localhost:5173` and allow microphone access. |
| **"Backend Offline" badge** | FastAPI backend is not running | Start the backend with `uvicorn src.main:app --reload` in terminal 1. |
| **`GNANI_API_KEY is missing`** | `.env` file absent or key not set | Add `GNANI_API_KEY=...` to your `.env` file in the project root. |
| **`GROQ_API_KEY is missing`** | `.env` file absent or key not set | Add `GROQ_API_KEY=...` to your `.env` file in the project root. |
| **Audio format conversion error** | `ffmpeg` not found on system PATH | Ensure FFmpeg is installed and added to your Windows PATH if converting non-standard audio formats. |
| **Unresolved Git tracking of `.env`** | `.env` was previously added to Git | Run `git rm --cached .env` to stop tracking it without deleting your local file. |
