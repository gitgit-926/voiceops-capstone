import os
import struct
from dotenv import load_dotenv
from gnani.tts import GnaniTTSClient, AudioConfig

load_dotenv()

api_key = os.getenv("GNANI_API_KEY")

if not api_key:
    raise RuntimeError("GNANI_API_KEY is missing from the .env file")

tts_client = GnaniTTSClient(api_key=api_key)


def generate_speech(text: str, language: str = "en-IN") -> bytes:
    """Synthesize text into speech using Gnani TTS and repair WAV headers if necessary."""
    if not text or not text.strip():
        raise ValueError("Cannot synthesize speech from empty text")

    try:
        audio = tts_client.synthesize(
            text,
            voice="Kaveri",
            model="timbre-v2.5",
            language=language,
            audio_config=AudioConfig(
                container="wav",
                sample_rate=16000,
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gnani TTS synthesis failed: {exc}") from exc

    if not audio:
        raise RuntimeError("Gnani TTS returned empty audio")

    # Correct WAV header chunk sizes when Gnani returns streaming placeholder sizes (0xFFFFFFFF)
    if audio[:4] == b"RIFF" and audio[8:12] == b"WAVE":
        audio = bytearray(audio)

        # Correct the RIFF chunk size
        struct.pack_into("<I", audio, 4, len(audio) - 8)

        # Correct the data chunk size if it uses a placeholder
        pos = 12
        while pos + 8 <= len(audio):
            chunk_id = audio[pos:pos + 4]
            chunk_size = struct.unpack_from("<I", audio, pos + 4)[0]

            if chunk_id == b"data" and chunk_size == 0xFFFFFFFF:
                struct.pack_into("<I", audio, pos + 4, len(audio) - pos - 8)
                break

            if chunk_size == 0xFFFFFFFF or chunk_size > len(audio) - pos - 8:
                break

            pos += 8 + chunk_size + (chunk_size % 2)

        audio = bytes(audio)

    return audio
