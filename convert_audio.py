import subprocess
from pathlib import Path

audio_path = input(
    "Enter the full path of your M4A recording: ").strip().strip('"')

output_path = Path(audio_path).with_suffix(".wav")
subprocess.run(
    [
        "ffmpeg",
        "-i", audio_path,
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        str(output_path),
    ],
    check=True,
)

print(f"Converted successfully: {output_path}")
