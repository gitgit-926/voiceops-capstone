from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KB_DIR = Path(__file__).resolve().parent.parent / "kb"

documents = []

for file_path in sorted(KB_DIR.glob("*.md")):
    content = file_path.read_text(encoding="utf-8")
    if content.strip():
        documents.append({
            "source": file_path.name,
            "content": content
        })

if not documents:
    raise RuntimeError(f"No Markdown documents found in {KB_DIR}")

vectorizer = TfidfVectorizer(stop_words="english")
document_vectors = vectorizer.fit_transform(
    [doc["content"] for doc in documents]
)


def search_knowledge_base(question: str, top_k: int = 3):
    question_vector = vectorizer.transform([question])
    scores = cosine_similarity(question_vector, document_vectors)[0]
    ranked_indices = scores.argsort()[::-1][:top_k]

    results = []

    for index in ranked_indices:
        if scores[index] <= 0:
            continue

        results.append({
            "source": documents[index]["source"],
            "content": documents[index]["content"],
            "score": round(float(scores[index]), 3)
        })

    return results
