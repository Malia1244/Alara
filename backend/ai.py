"""
Talks to Google's Gemini AI to turn a student's notes into quiz questions.

Kept separate from main.py so the "ask the AI for questions" logic is easy to
find and change without touching the API routes.
"""

import json
import os
from typing import Optional, TypedDict

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


class QuizQuestion(TypedDict):
    question: str
    options: list[str]
    correct_index: int


# This tells Gemini exactly what shape of JSON we want back, so we don't have
# to guess-parse free-form text.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 4,
                        "maxItems": 4,
                    },
                    "correct_index": {"type": "integer"},
                },
                "required": ["question", "options", "correct_index"],
            },
        }
    },
    "required": ["questions"],
}

TOPICS_SCHEMA = {
    "type": "object",
    "properties": {
        "topics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "subject": {"type": "string"},
                    "miss_count": {"type": "integer"},
                },
                "required": ["topic", "subject", "miss_count"],
            },
        }
    },
    "required": ["topics"],
}

FLASHCARDS_SCHEMA = {
    "type": "object",
    "properties": {
        "cards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "front": {"type": "string"},
                    "back": {"type": "string"},
                },
                "required": ["front", "back"],
            },
        }
    },
    "required": ["cards"],
}


class QuizGenerationError(Exception):
    pass


def _gemini_json(prompt: str, schema: dict) -> dict:
    if not GEMINI_API_KEY:
        raise QuizGenerationError(
            "GEMINI_API_KEY is not set. Check backend/.env"
        )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": schema,
        },
    }

    try:
        response = httpx.post(
            GEMINI_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=45.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise QuizGenerationError(
            f"Gemini API error ({exc.response.status_code}): {exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise QuizGenerationError(f"Could not reach Gemini: {exc}") from exc

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise QuizGenerationError(
            f"Unexpected response from Gemini: {data}"
        ) from exc


def generate_quiz_questions(
    subject: str,
    notes: str,
    num_questions: int = 5,
    focus_misses: Optional[list[str]] = None,
    focus_topics: Optional[list[str]] = None,
) -> list[QuizQuestion]:
    focus_block = ""
    if focus_misses or focus_topics:
        focus_block = (
            "\n\nIMPORTANT — this student has been missing some material. "
            "Make most of these new questions practice that weak material "
            "(rephrase ideas; do not copy questions word-for-word).\n"
        )
        if focus_topics:
            focus_block += (
                "Topics to emphasize:\n- "
                + "\n- ".join(focus_topics[:8])
                + "\n"
            )
        if focus_misses:
            focus_block += (
                "Recently missed questions (make related practice):\n- "
                + "\n- ".join(focus_misses[:8])
                + "\n"
            )

    prompt = (
        f"You are a friendly tutor helping a student review what they just "
        f"learned in {subject}.\n\n"
        f"Here are their notes:\n---\n{notes}\n---\n"
        f"{focus_block}\n"
        f"Write {num_questions} multiple choice questions that test whether "
        f"they understood and can remember this material. Each question "
        f"needs exactly 4 answer options, with only one correct answer. "
        f"Keep the wording clear and age-appropriate for a middle/high "
        f"school student. Vary which option index (0-3) is correct."
    )

    parsed = _gemini_json(prompt, RESPONSE_SCHEMA)
    return parsed["questions"]


def summarize_miss_topics(
    misses: list[dict],
) -> list[dict]:
    """
    Groups missed quiz questions into short review topics.
    Each miss dict: {question, subject}
    Returns: [{topic, subject, miss_count}, ...]
    """
    if not misses:
        return []

    # Fallback without Gemini: one topic bucket per subject.
    if not GEMINI_API_KEY:
        counts: dict[str, int] = {}
        for miss in misses:
            counts[miss["subject"]] = counts.get(miss["subject"], 0) + 1
        return [
            {
                "topic": f"Review {subject}",
                "subject": subject,
                "miss_count": count,
            }
            for subject, count in sorted(
                counts.items(), key=lambda item: item[1], reverse=True
            )
        ]

    lines = "\n".join(
        f"- [{miss['subject']}] {miss['question']}" for miss in misses[:40]
    )
    prompt = (
        "A student missed these quiz questions. Group them into short "
        "review topics (3-8 topics max). Each topic should be a clear "
        "idea they need to restudy (a few words), tied to the subject "
        "name, with how many listed misses belong to it.\n\n"
        f"Missed questions:\n{lines}"
    )
    try:
        parsed = _gemini_json(prompt, TOPICS_SCHEMA)
        topics = parsed.get("topics") or []
        # Keep only well-formed rows.
        cleaned = []
        for row in topics:
            topic = str(row.get("topic", "")).strip()
            subject = str(row.get("subject", "")).strip()
            if not topic:
                continue
            cleaned.append(
                {
                    "topic": topic,
                    "subject": subject or "General",
                    "miss_count": int(row.get("miss_count") or 1),
                }
            )
        return cleaned
    except QuizGenerationError:
        counts = {}
        for miss in misses:
            counts[miss["subject"]] = counts.get(miss["subject"], 0) + 1
        return [
            {
                "topic": f"Review {subject}",
                "subject": subject,
                "miss_count": count,
            }
            for subject, count in sorted(
                counts.items(), key=lambda item: item[1], reverse=True
            )
        ]


def generate_flashcards(
    subject: str,
    notes: str,
    num_cards: int = 10,
) -> list[dict]:
    """Make front/back study cards from the student's notes."""
    prompt = (
        f"You are helping a student make flashcards for {subject}.\n\n"
        f"Notes:\n---\n{notes}\n---\n\n"
        f"Create {num_cards} flashcards. Front = a short prompt or term. "
        f"Back = a clear, short answer (1-2 sentences max). "
        f"Age-appropriate for middle/high school. Cover the main ideas."
    )
    parsed = _gemini_json(prompt, FLASHCARDS_SCHEMA)
    cards = []
    for row in parsed.get("cards") or []:
        front = str(row.get("front", "")).strip()
        back = str(row.get("back", "")).strip()
        if front and back:
            cards.append({"front": front, "back": back})
    if not cards:
        raise QuizGenerationError("Gemini returned no usable flashcards")
    return cards
