import os
from importlib import import_module

from dotenv import load_dotenv
try:
    Groq = import_module("groq").Groq
except ImportError as exc:
    raise ImportError(
        "The 'groq' package is required. Install it in the active Python environment with: pip install groq"
    ) from exc

from src.rag import search_knowledge_base

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    raise RuntimeError("GROQ_API_KEY is missing from the .env file")

client = Groq(api_key=api_key)


def generate_answer(question: str):
    results = search_knowledge_base(question)

    if not results:
        return {
            "answer": "I couldn't find that information in the ZentroMart knowledge base. Please contact customer support for assistance.",
            "sources": []
        }

    context = "\n\n".join(
        f"Source: {item['source']}\n{item['content']}"
        for item in results
    )

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are ZentroMart's customer support assistant. "
                    "Answer using only the supplied knowledge-base context. "
                    "Do not invent policies, fees, or promises. "
                    "If the context does not answer the question, say so "
                    "and recommend contacting customer support."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Knowledge-base context:\n{context}\n\n"
                    f"Customer question: {question}"
                )
            }
        ],
        temperature=0.2
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": [item["source"] for item in results]
    }
