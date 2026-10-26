import os
from dotenv import load_dotenv
import importlib

try:
    Groq = importlib.import_module("groq").Groq
except ImportError as exc:
    raise SystemExit(
        "ERROR: The 'groq' package is unavailable. Install it in the active "
        "Python environment with: python -m pip install groq"
    ) from exc

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("ERROR: GROQ_API_KEY was not found in .env")
else:
    try:
        client = Groq(api_key=api_key)
        models = client.models.list()

        print("\nModels available to your API key:\n")

        for model in models.data:
            print(model.id)

    except Exception as e:
        print("ERROR:", e)
