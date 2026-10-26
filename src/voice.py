import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from dotenv import load_dotenv
from importlib import import_module

try:
    GnaniSTTClient = import_module("gnani.stt").GnaniSTTClient
except ModuleNotFoundError as exc:
    if exc.name != "gnani":
        raise
    raise RuntimeError(
        "The Gnani STT SDK is unavailable. Install the package that provides gnani.stt."
    ) from exc

load_dotenv()

api_key = os.getenv("GNANI_API_KEY")

if not api_key:
    raise RuntimeError("GNANI_API_KEY is missing from the .env file")

stt_client = GnaniSTTClient(api_key=api_key)

SUPPORTED_EXTENSIONS = {".ogg", ".flac", ".mp3", ".m4a", ".aac", ".wav"}


def convert_to_wav(source_path: Path) -> Path:
    """Convert an audio file to 16kHz mono WAV using ffmpeg if available."""
    ffmpeg_cmd = shutil.which("ffmpeg")
    if not ffmpeg_cmd:
        raise RuntimeError(
            f"Audio format '{source_path.suffix}' requires conversion, but ffmpeg is not installed on PATH."
        )

    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close()
    temp_wav_path = Path(temp_wav.name)

    try:
        subprocess.run(
            [
                ffmpeg_cmd,
                "-y",
                "-i", str(source_path),
                "-ac", "1",
                "-ar", "16000",
                "-c:a", "pcm_s16le",
                str(temp_wav_path),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return temp_wav_path
    except subprocess.CalledProcessError as err:
        if temp_wav_path.exists():
            temp_wav_path.unlink()
        err_msg = err.stderr.decode("utf-8", errors="replace") if err.stderr else str(err)
        raise RuntimeError(f"Audio conversion failed: {err_msg}") from err


def transcribe_audio(audio_path: str | Path, language_code: str = "en-IN") -> dict:
    """Transcribe an audio file using Gnani STT, converting formats like WebM if needed."""
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    if path.stat().st_size == 0:
        raise ValueError("Audio recording is empty (0 bytes).")

    converted_path = None
    target_path = path

    # If format is not in Gnani STT supported list, convert to .wav
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        converted_path = convert_to_wav(path)
        target_path = converted_path

    try:
        result = stt_client.transcribe(
            str(target_path),
            language_code=language_code,
        )
        return {
            "transcript": result.get("transcript", ""),
            "language": language_code,
        }
    except Exception as exc:
        raise RuntimeError(f"Gnani STT transcription failed: {exc}") from exc
    finally:
        if converted_path and converted_path.exists():
            try:
                converted_path.unlink()
            except OSError:
                pass
