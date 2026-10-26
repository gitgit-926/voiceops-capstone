import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, EmailStr

from src.answer import generate_answer
from src.rag import search_knowledge_base
from src.tts import generate_speech
from src.voice import transcribe_audio

app = FastAPI(
    title="ZentroMart Customer Support API",
    description="AI-powered voice customer-support backend for ZentroMart",
    version="1.0.0",
)

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = PROJECT_ROOT / "generated_audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR = PROJECT_ROOT / "data"

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load existing datasets for order verification
orders = pd.read_csv(DATA_DIR / "orders.csv", dtype=str).fillna("")
customers = pd.read_csv(DATA_DIR / "customers.csv", dtype=str).fillna("")

# Maximum upload size: 25 MB
MAX_UPLOAD_SIZE = 25 * 1024 * 1024
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+\.wav$")


# Pydantic schemas
class OrderVerification(BaseModel):
    email: EmailStr


class SpeechRequest(BaseModel):
    text: str
    language: str = "en-IN"



class ChatRequest(BaseModel):
    question: str


class TranscribeResponse(BaseModel):
    transcript: str
    language: str


class AskResponse(BaseModel):
    transcript: str
    answer: str
    sources: List[str]


class AskAudioResponse(BaseModel):
    transcript: str
    answer: str
    sources: List[str]
    audio_url: str
    audio_filename: str


async def _save_upload_to_temp(audio: UploadFile) -> Path:
    """Save an uploaded file to a temporary location safely."""
    raw_filename = audio.filename or "recording.wav"
    suffix = Path(raw_filename).suffix or ".wav"

    content = await audio.read()
    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty.",
        )
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded audio file exceeds the 25MB limit.",
        )

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        temp_file.write(content)
        temp_file.flush()
        return Path(temp_file.name)
    finally:
        temp_file.close()


# A. GET /
@app.get("/")
def home():
    """Simple confirmation that the API is running."""
    return {"message": "ZentroMart Customer Support API is running!"}


# B. GET /health
@app.get("/health")
def health():
    """API health status check."""
    return {"status": "healthy"}


# C. POST /voice/transcribe
@app.post("/voice/transcribe", response_model=TranscribeResponse)
async def voice_transcribe(
    audio: UploadFile = File(...),
    language_code: str = Form("en-IN"),
):
    """Accept an uploaded audio file and return speech transcript and detected/selected language."""
    temp_path = None
    try:
        temp_path = await _save_upload_to_temp(audio)
        result = transcribe_audio(temp_path, language_code)
        return {
            "transcript": result["transcript"],
            "language": result["language"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech transcription failed: {exc}",
        )
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


# D. POST /voice/ask
@app.post("/voice/ask", response_model=AskResponse)
async def voice_ask(
    audio: UploadFile = File(...),
    language_code: str = Form("en-IN"),
):
    """Transcribe customer voice and generate an AI answer grounded in the knowledge base (no TTS)."""
    temp_path = None
    try:
        temp_path = await _save_upload_to_temp(audio)

        # 1. Transcribe speech
        transcription = transcribe_audio(temp_path, language_code)
        question = transcription["transcript"]
        if not question or not question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not transcribe any speech from the provided audio.",
            )

        # 2. RAG + Groq answer generation
        answer_data = generate_answer(question)

        return {
            "transcript": question,
            "answer": answer_data["answer"],
            "sources": answer_data["sources"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice question processing failed: {exc}",
        )
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


# E. POST /voice/ask/audio (Primary endpoint used by the frontend)
@app.post("/voice/ask/audio", response_model=AskAudioResponse)
async def voice_ask_audio(
    audio: UploadFile = File(...),
    language_code: str = Form("en-IN"),
):
    """Complete voice pipeline: STT -> RAG -> Groq answer -> Gnani TTS -> Save WAV to generated_audio/."""
    temp_path = None
    try:
        temp_path = await _save_upload_to_temp(audio)

        # 1. Transcribe speech
        transcription = transcribe_audio(temp_path, language_code)
        question = transcription["transcript"]
        if not question or not question.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not detect speech in the recording. Please speak clearly and try again.",
            )

        # 2. Generate answer grounded in KB
        answer_data = generate_answer(question)
        answer_text = answer_data["answer"]

        # 3. Synthesize speech using Gnani TTS
        speech_bytes = generate_speech(answer_text, language_code)

        # 4. Save generated response WAV to generated_audio/
        audio_filename = f"response_{uuid.uuid4().hex}.wav"
        output_file = AUDIO_DIR / audio_filename
        output_file.write_bytes(speech_bytes)

        # 5. Return complete response
        return {
            "transcript": question,
            "answer": answer_text,
            "sources": answer_data["sources"],
            "audio_url": f"/voice/audio/{audio_filename}",
            "audio_filename": audio_filename,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice pipeline error: {exc}",
        )
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


# F. POST /voice/speak
@app.post("/voice/speak")
def voice_speak(request: SpeechRequest):
    """Direct text-to-speech endpoint returning raw WAV bytes without persistent file storage."""
    try:
        audio_bytes = generate_speech(request.text, request.language)
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": 'inline; filename="zentromart_speech.wav"'
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis error: {exc}",
        )


# Safe audio retrieval endpoint
@app.get("/voice/audio/{filename}")
def get_voice_audio(filename: str):
    """Safely serve generated WAV files from the generated_audio directory."""
    # Prevent directory traversal and invalid filenames
    if not SAFE_FILENAME_PATTERN.match(filename) or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio filename requested.",
        )

    file_path = (AUDIO_DIR / filename).resolve()

    # Ensure path stays within AUDIO_DIR
    try:
        file_path.relative_to(AUDIO_DIR.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access outside generated audio folder is denied.",
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found.",
        )

    return FileResponse(
        path=file_path,
        media_type="audio/wav",
        filename=filename,
    )


# G. Existing support endpoints (preserved)
@app.post("/orders/{order_id}/verify")
def verify_order(order_id: str, verification: OrderVerification):
    """Verify order ownership using customer email."""
    order = orders[orders["order_id"] == order_id]
    if order.empty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    customer_id = order.iloc[0]["customer_id"]
    customer = customers[
        (customers["customer_id"] == customer_id)
        & (
            customers["email"].str.strip().str.lower()
            == str(verification.email).strip().lower()
        )
    ]

    if customer.empty:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer verification failed",
        )

    return {
        "verified": True,
        "order": order.iloc[0].to_dict(),
    }


@app.get("/knowledge/search")
def search_knowledge(question: str):
    """Search the Markdown knowledge base with TF-IDF cosine similarity."""
    results = search_knowledge_base(question)
    return {
        "question": question,
        "results": results,
    }


@app.get("/chat")
def chat(question: str):
    """Chat endpoint using Groq + knowledge base retrieval."""
    if not question or not question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question parameter cannot be empty.",
        )
    return generate_answer(question)


@app.post("/chat")
def chat_post(request: ChatRequest):
    """POST chat endpoint using Groq + knowledge base retrieval."""
    if not request.question or not request.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )
    return generate_answer(request.question)

