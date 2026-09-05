"""
Talks to Google's Gemini AI to turn a student's notes into quiz questions.

Kept separate from main.py so the "ask the AI for questions" logic is easy to
find and change without touching the API routes.
"""

import json
import os
import re
from typing import Optional, TypedDict

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Default to a lite model — free-tier quotas for gemini-2.5-flash are easy
# to burn through while testing. Override with GEMINI_MODEL in backend/.env.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
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

# Detect diary / session questions so we never reuse them as review items
# and can drop them if the model still emits one.
_META_QUIZ_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bwhat did (you|we|i) (learn|study|cover|review|practice|do|work on)\b",
        r"\bwhat (have|had) (you|we|i) (learn|learned|study|studied|cover|covered)\b",
        r"\bwhat (subject|topic|material|lesson|unit) did (you|we|i)\b",
        r"\bwhat (was|were) (in )?(your|our|the) notes\b",
        r"\bwhat (did )?(you|we|i) (cover|study|learn).*\b(today|this (day|exact day|session|lesson))\b",
        r"\b(on )?this exact day\b",
        r"\b(today|this day|this session)\b.*\b(learn|learned|study|studied|cover|covered)\b",
        r"\b(learn|learned|study|studied|cover|covered)\b.*\b(today|this day|this exact day|this session)\b",
        r"\bdid (you|we|i) (learn|study|cover|practice)\b",
        r"\bwhat activity did (you|we|i)\b",
        r"\bwhat (have|had) (you|we|i) been (learning|studying)\b",
        r"\bwhich (topic|subject|material) did (you|we|i) (study|cover|learn)\b",
        r"\bwhich of the following did (you|we|i) (learn|study|cover)\b",
        r"\bwe (studied|learned|covered|reviewed)\b.*\b(true or false|t/?f)\b",
        r"\b(true or false|t/?f)\b.*\bwe (studied|learned|covered|reviewed)\b",
        r"\baccording to (your|the) notes,? what did\b",
        r"\b(your|the) notes (were|are) about\b",
        r"\b(your|the) notes covered\b",
        r"\bwhat was (today'?s|this) (lesson|topic|focus|subject)\b",
        r"\bmain thing (you|we|i) (learned|studied|covered)\b",
        r"\bfocus of (today|this (day|lesson|session))\b",
        r"\bwhat (are|were) (you|we|i) (learning|studying|working on)\b",
        r"\bbased on (your|the) (study )?session\b",
        r"\bfrom (your|the) (learning|study) (entry|log|session)\b",
    )
]

# Correct answers that are topic labels / diary replies, not knowledge.
_META_ANSWER_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"^(the )?(alphabet|abc'?s?|notes|lesson|homework|class|today|"
        r"session|material|topic|subject|unit)$",
        r"^(what )?(i|we|you) (learned|studied|covered|practiced).*$",
        r"^(my|our|the|today'?s?) (notes|lesson|homework|topic|focus)$",
        r"^(learning|studying|reviewing|practicing) .+$",
        r"^nothing( special)?$",
        r"^i don'?t (know|remember)$",
    )
]

_VAGUE_NOTES_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\b(we|i|you) (learned|studied|covered|practiced|reviewed)\b",
        r"\btoday (we|i) (learned|studied|covered)\b",
        r"\bworked on\b",
        r"\blearned about\b",
    )
]

FACTS_FOR_QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string"},
        "facts": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
        },
    },
    "required": ["topic", "facts"],
}


def is_meta_quiz_question(question: str) -> bool:
    """True if the question is about the study session, not the material."""
    text = (question or "").strip()
    if not text:
        return False
    return any(pattern.search(text) for pattern in _META_QUIZ_PATTERNS)


def _looks_like_meta_answer(answer: str) -> bool:
    text = (answer or "").strip()
    if not text:
        return False
    return any(pattern.search(text) for pattern in _META_ANSWER_PATTERNS)


def is_meta_quiz_item(item: dict) -> bool:
    """True if the question or its correct option is session/diary meta."""
    if is_meta_quiz_question(item.get("question", "")):
        return True
    options = item.get("options") or []
    idx = item.get("correct_index")
    if isinstance(idx, int) and 0 <= idx < len(options):
        if _looks_like_meta_answer(str(options[idx])):
            return True
    return False


def _notes_need_fact_expansion(notes: str) -> bool:
    text = (notes or "").strip()
    if len(text) < 220:
        return True
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) <= 3 and any(p.search(text) for p in _VAGUE_NOTES_PATTERNS):
        return True
    return False


def expand_notes_for_quiz(subject: str, notes: str) -> str:
    """
    Turn thin/vague study logs into concrete facts the quiz can test.
    Falls back to the original notes if expansion fails.
    """
    text = (notes or "").strip()
    if not text or not _notes_need_fact_expansion(text):
        return text

    prompt = (
        f"A student logged brief notes for {subject}. Expand them into "
        f"concrete study facts that a real quiz could test.\n\n"
        f"Notes:\n---\n{text}\n---\n\n"
        f"Return a short topic label plus at least 6 specific facts, rules, "
        f"definitions, steps, examples, or skills from that topic.\n"
        f"If notes only say something like \"we learned the alphabet\", "
        f"list alphabet knowledge itself (letter order, vowel vs consonant, "
        f"letter sounds, words that start with a letter, uppercase/lowercase).\n"
        f"Do NOT list meta facts like \"the student studied today\" or "
        f"\"the topic was the alphabet\". Every fact must be content."
    )
    try:
        parsed = _gemini_json(prompt, FACTS_FOR_QUIZ_SCHEMA)
    except Exception:
        return text

    facts = [
        str(f).strip()
        for f in (parsed.get("facts") or [])
        if str(f).strip() and not is_meta_quiz_question(str(f))
    ]
    if len(facts) < 4:
        return text

    topic = str(parsed.get("topic") or subject).strip() or subject
    bullet_block = "\n".join(f"- {f}" for f in facts[:16])
    return (
        f"Topic: {topic}\n"
        f"Original notes: {text}\n"
        f"Quizable facts (use ONLY these as the quiz source):\n"
        f"{bullet_block}"
    )

TEACH_OPENER_SCHEMA = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
    },
    "required": ["message"],
}

TEACH_REPLY_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": ["confused", "clarify", "understood"],
        },
        "message": {"type": "string"},
        "follow_up": {"type": "string"},
        "lesson_summary": {"type": "string"},
    },
    "required": ["status", "message"],
}


def format_ara_memories(memories: list[dict]) -> str:
    """Turn saved lesson rows into a short prompt block."""
    lines = []
    for row in memories[:8]:
        topic = str(row.get("topic") or "").strip()
        subject = str(row.get("subject") or "").strip()
        summary = str(row.get("summary") or "").strip()
        if not topic or not summary:
            continue
        label = f"[{subject}] {topic}" if subject else topic
        lines.append(f"- {label}: {summary}")
    return "\n".join(lines)


class QuizGenerationError(Exception):
    pass


def _gemini_json(prompt: str, schema: dict) -> dict:
    return _gemini_json_parts([{"text": prompt}], schema)


def _gemini_json_parts(parts: list[dict], schema: dict) -> dict:
    if not GEMINI_API_KEY:
        raise QuizGenerationError(
            "GEMINI_API_KEY is not set. Check backend/.env"
        )

    payload = {
        "contents": [{"parts": parts}],
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
            timeout=60.0,
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


_DIFFICULTY_GUIDANCE = {
    "easy": (
        "Difficulty: EASY. Use straightforward recall and basic understanding. "
        "Keep wording simple, avoid tricks, and make the correct answer clearly "
        "supported by the notes."
    ),
    "medium": (
        "Difficulty: MEDIUM. Mix recall with light application. Questions should "
        "need a bit of thinking, but stay fair for someone who studied the notes."
    ),
    "hard": (
        "Difficulty: HARD. Prefer application, comparison, and multi-step "
        "thinking. Wrong options should be plausible. Still stay grounded in "
        "the notes — do not invent unrelated advanced topics."
    ),
}


def generate_quiz_questions(
    subject: str,
    notes: str,
    num_questions: int = 5,
    difficulty: str = "medium",
    focus_misses: Optional[list[str]] = None,
    focus_topics: Optional[list[str]] = None,
) -> list[QuizQuestion]:
    # Never feed meta / diary misses back into the model as "practice targets".
    content_misses = [
        q for q in (focus_misses or []) if q and not is_meta_quiz_question(q)
    ]

    # Thin logs like "we learned the alphabet" become concrete facts first.
    quiz_source = expand_notes_for_quiz(subject, notes)

    focus_block = ""
    if content_misses or focus_topics:
        focus_block = (
            "\n\nIMPORTANT — this student has been missing some material. "
            "Make most of these new questions practice that weak material "
            "(rephrase ideas; do not copy questions word-for-word). "
            "Practice the CONTENT of those misses — never ask what they "
            "studied or learned that day.\n"
        )
        if focus_topics:
            focus_block += (
                "Topics to emphasize:\n- "
                + "\n- ".join(focus_topics[:8])
                + "\n"
            )
        if content_misses:
            focus_block += (
                "Recently missed questions (make related content practice):\n- "
                + "\n- ".join(content_misses[:8])
                + "\n"
            )

    difficulty_key = difficulty if difficulty in _DIFFICULTY_GUIDANCE else "medium"
    difficulty_block = _DIFFICULTY_GUIDANCE[difficulty_key]

    def _build_prompt(count: int) -> str:
        return (
            f"You are a friendly tutor helping a student review {subject}.\n\n"
            f"Here is the study material (the ONLY source of facts to quiz on):\n"
            f"---\n{quiz_source}\n---\n"
            f"{focus_block}\n"
            f"{difficulty_block}\n\n"
            f"Write {count} multiple choice questions that test the "
            f"ACTUAL information, skills, facts, vocabulary, and concepts "
            f"above — as if this were a real class quiz on the material.\n\n"
            f"Every question MUST check a concrete fact or skill "
            f"(letter order, sounds, definitions, steps, formulas, examples, "
            f"cause/effect, vocabulary meaning, etc.).\n\n"
            f"A student who never saw these notes should still be able to "
            f"answer from knowing the subject content — not from remembering "
            f"what was logged in the app.\n\n"
            f"CRITICAL — FORBIDDEN meta / diary questions about the learning "
            f"session. The student already knows what they studied. Never ask "
            f"what they learned, covered, studied, practiced, or did today / "
            f"this day / this session. Ban questions like:\n"
            f"- What did we / you learn today / on this exact day?\n"
            f"- What subject / topic did we cover?\n"
            f"- Did we learn the alphabet / X?\n"
            f"- What was in your notes?\n"
            f"- What activity did you do?\n"
            f"- What was today's lesson / focus?\n\n"
            f"GOOD examples (content): \"Which letter comes after M?\" "
            f"\"What sound does B make?\" \"Which word starts with A?\" "
            f"\"What does photosynthesis produce?\"\n"
            f"BAD examples (meta — never write these): "
            f"\"What did you learn today?\" "
            f"\"What did you learn on this exact day?\" "
            f"\"We studied the alphabet — true or false?\" "
            f"\"What topic was in your notes?\"\n\n"
            f"Never use topic labels as the correct answer "
            f"(e.g. \"the alphabet\", \"today's notes\", \"math\"). "
            f"The correct option must be a real content answer "
            f"(a letter, sound, definition, number, example, etc.).\n\n"
            f"Each question needs exactly 4 answer options, with only one "
            f"correct answer. Keep wording clear and age-appropriate for a "
            f"middle/high school student. Vary which option index (0-3) is "
            f"correct."
        )

    questions: list[QuizQuestion] = []
    seen_questions: set[str] = set()

    # Generate, then refill until we have enough content questions (or give up).
    for attempt in range(3):
        shortfall = num_questions - len(questions)
        if shortfall <= 0:
            break
        parsed = _gemini_json(_build_prompt(shortfall), RESPONSE_SCHEMA)
        for q in parsed.get("questions") or []:
            text = (q.get("question") or "").strip()
            if not text or text in seen_questions or is_meta_quiz_item(q):
                continue
            seen_questions.add(text)
            questions.append(q)  # type: ignore[arg-type]
            if len(questions) >= num_questions:
                break

    return questions[:num_questions]


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
    avoid_fronts: Optional[list[str]] = None,
) -> list[dict]:
    """Make front/back study cards from the student's notes."""
    avoid_block = ""
    if avoid_fronts:
        listed = "\n".join(f"- {front}" for front in avoid_fronts[:40])
        avoid_block = (
            "\nDo NOT repeat these prompts (make fresh ones):\n"
            f"{listed}\n"
        )
    prompt = (
        f"You are helping a student practice {subject}.\n\n"
        f"Notes:\n---\n{notes}\n---\n\n"
        f"Create {num_cards} practice cards. Front = a short question or "
        f"prompt (not a vocabulary word list). Back = a clear, short answer "
        f"(1-2 sentences max). Age-appropriate for middle/high school. "
        f"Cover the main ideas.{avoid_block}"
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


def teach_ara_opener(
    subject: str,
    topic: str,
    notes: str = "",
    memories: Optional[list[dict]] = None,
) -> str:
    """Ara asks the student to teach her a topic."""
    notes_block = ""
    if notes.strip():
        notes_block = (
            f"\nBackground from the student's notes (do NOT quote them "
            f"directly; just pick a curious angle):\n---\n{notes[:2500]}\n---\n"
        )
    memory_block = format_ara_memories(memories or [])
    memory_section = ""
    if memory_block:
        memory_section = (
            "\nThings the student already taught you before (you MAY briefly "
            "mention one related memory if it fits, otherwise just ask to "
            "learn/relearn this topic):\n"
            f"{memory_block}\n"
        )
    prompt = (
        "You are Ara, a friendly curious study buddy sitting at a desk. "
        "The student will teach you.\n\n"
        f"Subject: {subject}\n"
        f"Topic to learn: {topic}\n"
        f"{notes_block}"
        f"{memory_section}\n"
        "Write ONE short spoken line (1-2 sentences) asking them to teach "
        "you this topic. Sound eager and a little confused, like a classmate. "
        "No bullet lists. Do not explain the topic yourself."
    )
    if not GEMINI_API_KEY:
        return (
            f"Can you teach me about {topic}? I keep getting mixed up in "
            f"{subject}…"
        )
    try:
        parsed = _gemini_json(prompt, TEACH_OPENER_SCHEMA)
        message = str(parsed.get("message", "")).strip()
        if message:
            return message
    except QuizGenerationError:
        pass
    return (
        f"Can you teach me about {topic}? I keep getting mixed up in "
        f"{subject}…"
    )


def teach_ara_reply(
    subject: str,
    topic: str,
    user_message: str,
    history: list[dict],
    notes: str = "",
    memories: Optional[list[dict]] = None,
) -> dict:
    """
    React to the student's teaching attempt.
    Returns {status, message, follow_up, lesson_summary} where status is
    confused | clarify | understood.
    """
    history_lines = []
    for turn in history[-8:]:
        role = "Student" if turn.get("role") == "user" else "Ara"
        text = str(turn.get("content", "")).strip()
        if text:
            history_lines.append(f"{role}: {text}")
    history_block = "\n".join(history_lines) if history_lines else "(none yet)"
    notes_block = notes.strip()[:2500] or "(no notes on file)"
    memory_block = format_ara_memories(memories or [])
    memory_section = (
        f"Things you already learned from this student before:\n{memory_block}\n\n"
        if memory_block
        else ""
    )

    prompt = (
        "You are Ara, a curious study buddy. The student is TEACHING you. "
        "You are not the tutor — do not lecture, scold, or dump the full "
        "correct answer. React like a classmate trying to learn.\n\n"
        f"Subject: {subject}\n"
        f"Topic: {topic}\n"
        f"Student notes (PRIVATE ground truth for judging accuracy — "
        f"never paste them, never say \"according to your notes\"):\n"
        f"---\n{notes_block}\n---\n\n"
        f"{memory_section}"
        f"Recent chat:\n{history_block}\n\n"
        f"Student just said:\n---\n{user_message}\n---\n\n"
        "Judge the student's explanation against the notes/topic:\n"
        '- "confused" — WRONG, contradictory, empty, nonsense, or so vague '
        "you can't learn from it. Start like \"I don't understand…\". "
        "Gently point at the mismatch (\"Wait, I thought X meant…?\" / "
        "\"That sounds different from what I expected…\") and ask them to "
        "try again. Do NOT say you understand. Do NOT give the full right "
        "answer yourself.\n"
        '- "clarify" — partly right but incomplete, fuzzy, or missing a '
        "key piece. Start like \"Can you clarify…\". Ask about the missing "
        "bit only.\n"
        '- "understood" — ONLY if the explanation is basically correct and '
        "clear enough. Start like \"I understand now…\", restate the idea "
        "in your own short words, then optionally ask one tiny check "
        "question in follow_up. If anything important is wrong, do NOT "
        "use understood — use confused or clarify instead.\n\n"
        "message: 1-3 short sentences, warm and age-appropriate. "
        "follow_up: optional next question from Ara (string, or empty).\n"
        "lesson_summary: if status is understood, write 1-2 sentences in "
        "YOUR words of what you learned to remember later; otherwise empty."
    )

    fallback = {
        "status": "clarify",
        "message": (
            f"Can you clarify {topic} a little more? I almost get it, "
            "but one part is still fuzzy."
        ),
        "follow_up": "",
        "lesson_summary": "",
    }

    if not GEMINI_API_KEY:
        text = user_message.strip()
        if len(text) < 20:
            return {
                "status": "confused",
                "message": (
                    "I don't understand yet — can you explain it in a "
                    "couple of sentences?"
                ),
                "follow_up": "",
                "lesson_summary": "",
            }
        if len(text) < 80:
            return fallback
        return {
            "status": "understood",
            "message": (
                f"I understand now! So for {topic}, it's basically what "
                "you just said — thanks for teaching me."
            ),
            "follow_up": "What should I remember first if this comes up on a quiz?",
            "lesson_summary": (
                f"{topic}: {text[:220].rstrip()}."
                if text
                else f"Basics of {topic}."
            ),
        }

    try:
        parsed = _gemini_json(prompt, TEACH_REPLY_SCHEMA)
    except QuizGenerationError:
        return fallback

    status = str(parsed.get("status", "clarify")).strip().lower()
    if status not in ("confused", "clarify", "understood"):
        status = "clarify"
    message = str(parsed.get("message", "")).strip() or fallback["message"]
    follow_up = str(parsed.get("follow_up") or "").strip()
    lesson_summary = str(parsed.get("lesson_summary") or "").strip()
    if status == "understood" and not lesson_summary:
        # Fall back to Ara's spoken restatement so we still save a memory.
        lesson_summary = message[:280]
    if status != "understood":
        lesson_summary = ""
    return {
        "status": status,
        "message": message,
        "follow_up": follow_up,
        "lesson_summary": lesson_summary,
    }


HOMEWORK_HELP_SCHEMA = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
        "follow_up": {"type": "string"},
    },
    "required": ["message"],
}


LEARNING_EXPLAIN_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "how_to": {"type": "string"},
        "tip": {"type": "string"},
    },
    "required": ["summary", "how_to"],
}


def explain_learning_notes(
    notes: str,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
) -> dict:
    """
    Turn a student's messy learning-log notes into a short Ara explanation:
    what they covered + how to do the problems/concepts.
    """
    text = (notes or "").strip()
    subject_line = subject.strip() if subject else "General"
    unit_line = unit.strip() if unit else ""
    context = f"{subject_line}" + (f" · {unit_line}" if unit_line else "")

    fallback = {
        "summary": (
            "Here's the big idea from your notes: focus on the main concept "
            "you wrote down and the steps you practiced."
        ),
        "how_to": (
            "1) Re-read the key terms.\n"
            "2) Try one example slowly, writing each step.\n"
            "3) Check whether your answer matches the method in your notes."
        ),
        "tip": "If one step feels fuzzy, circle it — that's the best place to practice next.",
    }

    if not text:
        return {
            "summary": "Add a few notes first, and I'll explain what they mean in plain language.",
            "how_to": "Type what you learned or paste a problem, then tap explain again.",
            "tip": "",
        }

    if not GEMINI_API_KEY:
        # Offline-friendly stub so the button still feels useful in local dev.
        snippet = text[:220].replace("\n", " ")
        return {
            "summary": (
                f"From your {context} notes, it looks like you're working on: "
                f"{snippet}{'…' if len(text) > 220 else ''}"
            ),
            "how_to": fallback["how_to"],
            "tip": fallback["tip"],
        }

    prompt = (
        "You are Ara, a friendly study buddy for middle/high school students.\n"
        "The student just logged what they learned today. Their notes may be "
        "messy, incomplete, or hard for them to understand.\n\n"
        "Explain their notes back to them in clear, simple language.\n\n"
        "Rules:\n"
        "- Be short and helpful — not a textbook chapter.\n"
        "- summary: 2-4 sentences on WHAT they learned / the main idea.\n"
        "- how_to: a short step-by-step on HOW to do the problems or use the "
        "concept (use numbered steps when useful).\n"
        "- tip: one optional encouraging study tip (or empty string).\n"
        "- If notes are vague, do your best and say what to add next.\n"
        "- Do not invent facts that contradict the notes; fill small gaps "
        "only when needed to teach clearly.\n"
        "- Warm, age-appropriate tone.\n\n"
        f"Subject context: {context}\n\n"
        f"Student notes:\n---\n{text[:6000]}\n---\n\n"
        "Return JSON with summary, how_to, and tip."
    )

    try:
        parsed = _gemini_json(prompt, LEARNING_EXPLAIN_SCHEMA)
    except QuizGenerationError:
        return fallback

    summary = str(parsed.get("summary", "")).strip() or fallback["summary"]
    how_to = str(parsed.get("how_to", "")).strip() or fallback["how_to"]
    tip = str(parsed.get("tip") or "").strip()
    return {"summary": summary, "how_to": how_to, "tip": tip}


NOTES_FROM_IMAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "content": {"type": "string"},
    },
    "required": ["content"],
}


def extract_notes_from_image(
    image_base64: str,
    image_mime: str,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
) -> str:
    """
    Read a photo of handwritten notes / a worksheet into plain study text
    that can be saved as a learning-log entry and used for quizzes.
    """
    subject_label = (subject or "").strip() or "this subject"
    unit_label = (unit or "").strip()
    context = (
        f"Subject: {subject_label}"
        + (f"\nUnit: {unit_label}" if unit_label else "")
    )

    prompt = (
        "You are helping a student turn a PHOTO of their notes or worksheet "
        "into clean study notes for a learning log.\n\n"
        f"{context}\n\n"
        "Read everything useful from the attached image and return plain text "
        "notes the student can save and quiz on later.\n\n"
        "Rules:\n"
        "- Capture facts, vocabulary, definitions, steps, formulas, examples, "
        "and key ideas from the photo.\n"
        "- Keep wording clear and faithful to what's on the page.\n"
        "- Organize with short lines or bullets when helpful.\n"
        "- Ignore page decorations, doodles, and unrelated margins.\n"
        "- Do NOT invent material that is not visible.\n"
        "- Do NOT write meta lines like \"the student learned…\" or "
        "\"these notes say…\" — just the study content itself.\n"
        "- If the photo is blurry or empty, return a short note saying what "
        "is missing so they can retake it.\n\n"
        "Return JSON with:\n"
        "- content: the extracted study notes as plain text"
    )

    if not GEMINI_API_KEY:
        return (
            "(Could not read the photo — Gemini API key is missing on the "
            "server.)"
        )

    mime = (image_mime or "image/jpeg").split(";")[0].strip().lower()
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        mime = "image/jpeg"
    raw = image_base64 or ""
    if "," in raw and raw.strip().lower().startswith("data:"):
        raw = raw.split(",", 1)[1]

    parts: list[dict] = [
        {"text": prompt},
        {"inline_data": {"mime_type": mime, "data": raw}},
    ]
    parsed = _gemini_json_parts(parts, NOTES_FROM_IMAGE_SCHEMA)
    return str(parsed.get("content", "")).strip()


def homework_help_reply(
    question: str,
    history: list[dict],
    image_base64: Optional[str] = None,
    image_mime: Optional[str] = None,
) -> dict:
    """
    Help a student with a homework question (typed and/or from a photo).
    Returns {message, follow_up}.
    """
    history_lines = []
    for turn in history[-10:]:
        role = "Student" if turn.get("role") == "user" else "Ara"
        text = str(turn.get("content", "")).strip()
        if text:
            history_lines.append(f"{role}: {text}")
    history_block = "\n".join(history_lines) if history_lines else "(none yet)"
    question_text = (question or "").strip()
    has_image = bool(image_base64 and image_mime)

    prompt = (
        "You are Ara, a warm study buddy helping a middle/high school student "
        "with homework. Your job is to HELP them learn — not to silently do "
        "the assignment for them.\n\n"
        "Rules:\n"
        "- If there's a homework photo, first briefly say what problem you see.\n"
        "- Guide with steps, hints, and questions. Prefer Socratic coaching.\n"
        "- You MAY show worked steps for math/science when that teaches clearly, "
        "but also explain WHY each step works.\n"
        "- Do NOT only dump a final answer with no explanation.\n"
        "- Keep the tone friendly, short, and age-appropriate (2-5 short "
        "paragraphs or a clear step list).\n"
        "- If the question is incomplete, ask what they need.\n"
        "- Never help with cheating on live tests in a sneaky way; if they say "
        "it's a test they're taking right now, encourage honest studying.\n\n"
        f"Recent chat:\n{history_block}\n\n"
        f"Student question/text:\n---\n"
        f"{question_text or '(see attached homework image)'}\n---\n\n"
        f"{'An image of their homework is attached.' if has_image else ''}\n\n"
        "Return JSON with:\n"
        "- message: your helpful reply\n"
        "- follow_up: optional short question to keep them thinking (or empty)"
    )

    fallback = {
        "message": (
            "I want to help! Tell me a bit more about the problem — or "
            "upload a clearer photo — and we'll figure out the next step "
            "together."
        ),
        "follow_up": "Which part feels hardest right now?",
    }

    if not GEMINI_API_KEY:
        if question_text:
            return {
                "message": (
                    f"Let's tackle this together. Looking at your question, "
                    f"start by writing what you already know, then we'll "
                    f"check the next step.\n\nYou asked: {question_text[:280]}"
                ),
                "follow_up": "What have you tried so far?",
            }
        return fallback

    parts: list[dict] = [{"text": prompt}]
    if has_image:
        mime = (image_mime or "image/jpeg").split(";")[0].strip().lower()
        if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
            mime = "image/jpeg"
        # Strip data-URL prefix if the client sent one.
        raw = image_base64 or ""
        if "," in raw and raw.strip().lower().startswith("data:"):
            raw = raw.split(",", 1)[1]
        parts.append({"inline_data": {"mime_type": mime, "data": raw}})

    try:
        parsed = _gemini_json_parts(parts, HOMEWORK_HELP_SCHEMA)
    except QuizGenerationError:
        return fallback

    message = str(parsed.get("message", "")).strip() or fallback["message"]
    follow_up = str(parsed.get("follow_up") or "").strip()
    return {"message": message, "follow_up": follow_up}
