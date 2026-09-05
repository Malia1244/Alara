import os
import random
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from dotenv import load_dotenv

# Must run before importing ai.py, since it reads GEMINI_API_KEY as soon as
# it's imported — if .env hasn't been loaded yet, it grabs an empty value.
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

from ai import (
    QuizGenerationError,
    explain_learning_notes,
    extract_notes_from_image,
    generate_flashcards,
    generate_quiz_questions,
    homework_help_reply,
    is_meta_quiz_item,
    is_meta_quiz_question,
    summarize_miss_topics,
    teach_ara_opener,
    teach_ara_reply,
)
from auth import CurrentUserId

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Check backend/.env",
        )
    if not SUPABASE_URL.startswith("https://"):
        raise HTTPException(
            status_code=500,
            detail=(
                "SUPABASE_URL must be your project URL "
                "(https://xxxxx.supabase.co), not an API key."
            ),
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# Quiz defaults / caps. Prefer recently missed questions for review, then
# older spaced-repetition items, with the rest freshly generated.
DEFAULT_QUIZ_QUESTIONS = 8
MIN_QUIZ_QUESTIONS = 3
MAX_QUIZ_QUESTIONS = 15
MAX_REVIEW_QUESTIONS = 3
MAX_MISS_REUSE = 3
REVIEW_MIN_AGE_DAYS = 7
VALID_QUIZ_DIFFICULTIES = {"easy", "medium", "hard"}
# How far back we look when spotting miss patterns for the next quiz /
# progress page.
MISS_LOOKBACK_QUIZZES = 12

# Every correct quiz answer earns this many points, which can be spent in
# the shop. There's only one "profile" for now (no accounts yet), so we
# keep a single row in user_stats to track the running total.
POINTS_PER_CORRECT_ANSWER = 10
# Prize for logging what you learned (once per subject per calendar day).
POINTS_PER_LEARNING_ENTRY = 25

# The shop's catalog lives on the backend (not the frontend) so prices
# can't be tampered with from the browser — the client only ever sends an
# item_id, and the price charged always comes from this list.
#
# "image" is an optional filename inside frontend/public/shop-items/, for
# hand-drawn artwork. Until an item has one, the frontend falls back to
# showing its "emoji" instead — so you can add drawings one at a time
# without anything looking broken in the meantime.
#
# "slot" groups items that occupy the same spot on Ara (e.g. only one hat
# can be worn at once). Owning several items in the same slot is fine —
# only whichever one is "equipped" actually shows up on her.
#
# "fullImage" is an optional filename inside frontend/public/outfits/ — a
# full re-render of Ara actually wearing the item (rather than a cropped
# sticker composited on top of her). When present, the frontend swaps her
# whole portrait for this image instead of overlaying "image" on top of the
# base mascot, which is what makes hats look properly worn instead of
# floating in front of her.
# Closet = named complete looks only (hair + top + bottoms + shoes baked into
# one portrait). A small curated set lives in public/outfits/looks/ so the
# giant combos/ folder can stay off free Vercel deploys.
CLASSIC_OUTFIT_ID = "look-lavender-soft"
CLOTHING_SLOTS = ("outfit", "hair", "head", "top", "pants")
FREE_STARTER_ITEM_IDS = ["look-lavender-soft"]

# "pieces" is shown in the shop as the outfit breakdown (not mix-and-match).
SHOP_CATALOG = [
    {
        "id": "look-lavender-soft",
        "name": "Lavender Soft Day",
        "emoji": "💜",
        "fullImage": "looks/look-lavender-soft.webp",
        "price": 0,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Lavender heart hoodie · Ruffle lavender shorts · Heart Mary Janes",
    },
    {
        "id": "look-lavender-denim",
        "name": "Lavender Denim Day",
        "emoji": "💙",
        "fullImage": "looks/look-lavender-denim.webp",
        "price": 100,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Lavender heart hoodie · Heart-patch denim · Heart Mary Janes",
    },
    {
        "id": "look-cherry-denim",
        "name": "Sweet Cherry Casual",
        "emoji": "🍒",
        "fullImage": "looks/look-cherry-denim.webp",
        "price": 95,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Cherry tee · Heart-patch denim · Heart Mary Janes",
    },
    {
        "id": "look-strawberry-cozy",
        "name": "Strawberry Cozy Set",
        "emoji": "🍓",
        "fullImage": "looks/look-strawberry-cozy.webp",
        "price": 120,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Strawberry zip hoodie · Pink sweats · Heart Mary Janes",
    },
    {
        "id": "look-cloud-lounge",
        "name": "Cloud Lounge",
        "emoji": "☁️",
        "fullImage": "looks/look-cloud-lounge.webp",
        "price": 100,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Cloud & stars tee · Pink sweats · Heart Mary Janes",
    },
    {
        "id": "look-sunny-plaid",
        "name": "Sunshine Plaid",
        "emoji": "☀️",
        "fullImage": "looks/look-sunny-plaid.webp",
        "price": 105,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Sunny tee · Cream plaid pants · Heart Mary Janes",
    },
    {
        "id": "look-bow-cargo",
        "name": "Bow & Cargo",
        "emoji": "🎀",
        "fullImage": "looks/look-bow-cargo.webp",
        "price": 110,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Pink bow tee · Lavender cargos · Heart Mary Janes",
    },
    {
        "id": "look-ok-denim",
        "name": "Star OK Denim",
        "emoji": "⭐",
        "fullImage": "looks/look-ok-denim.webp",
        "price": 115,
        "slot": "outfit",
        "pieces": "Classic Pigtails · OK hoodie · Heart-patch denim · Heart Mary Janes",
    },
    {
        "id": "look-bear-weekend",
        "name": "Bear Patch Weekend",
        "emoji": "🧸",
        "fullImage": "looks/look-bear-weekend.webp",
        "price": 125,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Bear patch cardigan · Cream plaid pants · Heart Mary Janes",
    },
    {
        "id": "look-floral-cargo",
        "name": "Floral Cargo Day",
        "emoji": "🌸",
        "fullImage": "looks/look-floral-cargo.webp",
        "price": 130,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Floral cardigan · Lavender cargos · Heart Mary Janes",
    },
    {
        "id": "look-denim-jacket",
        "name": "Flower Jacket Denim",
        "emoji": "👖",
        "fullImage": "looks/look-denim-jacket.webp",
        "price": 140,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Flower denim jacket · Heart-patch denim · Heart Mary Janes",
    },
    {
        "id": "look-stripe-lounge",
        "name": "Pink Stripe Lounge",
        "emoji": "👚",
        "fullImage": "looks/look-stripe-lounge.webp",
        "price": 110,
        "slot": "outfit",
        "pieces": "Classic Pigtails · Pink stripe sweater · Pink sweats · Heart Mary Janes",
    },
    {
        "id": "theme-sleek",
        "name": "Sleek Mode",
        "emoji": "🖤",
        "price": 150,
        "slot": "theme",
        "pieces": "Clean gray & indigo app look — unlock with points",
    },
    {
        "id": "theme-playful",
        "name": "Playful Mode",
        "emoji": "🎀",
        "price": 150,
        "slot": "theme",
        "pieces": "Warm orange & pink app look — unlock with points",
    },
]

SHOP_ITEMS_BY_ID = {item["id"]: item for item in SHOP_CATALOG}

app = FastAPI(title="Alara API")

# Comma-separated list, e.g. "http://localhost:3000,https://alara.vercel.app"
_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    unit: str = Field(..., min_length=1, max_length=200)
    days_until_test: Optional[int] = Field(default=None, ge=0)


class SubjectUpdate(BaseModel):
    """Partial update — currently used to set the next test date after check-in."""
    days_until_test: Optional[int] = Field(default=None, ge=0)
    test_date: Optional[str] = None  # YYYY-MM-DD
    unit: Optional[str] = Field(default=None, min_length=1, max_length=200)


class Subject(BaseModel):
    id: str
    name: str
    unit: str
    test_date: Optional[str] = None
    days_until_test: Optional[int] = None
    created_at: str


def to_subject(row: dict) -> Subject:
    """Turns the stored test_date into a "days from today" count, which is
    what the homepage shows. Storing a real date (instead of just a number)
    means this stays correct every day instead of going stale."""
    days_until_test = None
    if row.get("test_date"):
        test_date = date.fromisoformat(row["test_date"])
        days_until_test = (test_date - date.today()).days
    return Subject(
        id=row["id"],
        name=row["name"],
        unit=row["unit"],
        test_date=row.get("test_date"),
        days_until_test=days_until_test,
        created_at=row["created_at"],
    )


# Stored when the student checks in with nothing new to log; quizzes review
# past notes instead. Keep in sync with frontend/src/lib/learning.ts.
NO_NEW_LEARNING_CONTENT = "No new material today — reviewing past notes."


def is_no_new_learning(content: Optional[str]) -> bool:
    return (content or "").strip() == NO_NEW_LEARNING_CONTENT


def study_note_chunks(rows: list) -> list[str]:
    """Real study notes only — skip empty / no-new check-ins."""
    chunks: list[str] = []
    for row in rows:
        text = (row.get("content") or "").strip()
        if text and not is_no_new_learning(text):
            chunks.append(text)
    return chunks


class LearningEntryCreate(BaseModel):
    subject_id: str
    content: str = Field(..., min_length=1)


class LearningEntry(BaseModel):
    id: str
    subject_id: Optional[str] = None
    subject: str
    unit: Optional[str] = None
    content: str
    created_at: str
    # Filled on create when this log earns the daily study prize.
    points_earned: int = 0
    total_points: Optional[int] = None


class ExplainNotesRequest(BaseModel):
    """Explain draft notes before they're saved (or any pasted text)."""
    content: str = Field(..., min_length=1)
    subject: Optional[str] = None
    unit: Optional[str] = None


class ExplainNotesResponse(BaseModel):
    summary: str
    how_to: str
    tip: str = ""


class NotesFromImageRequest(BaseModel):
    """Read handwritten / worksheet photos into plain study notes text."""
    image_base64: str = Field(..., min_length=1, max_length=6_000_000)
    image_mime: str = Field(..., min_length=3, max_length=64)
    subject: Optional[str] = None
    unit: Optional[str] = None


class NotesFromImageResponse(BaseModel):
    content: str


class QuizQuestionPublic(BaseModel):
    question: str
    options: List[str]
    # Only filled in once the quiz has been submitted — kept hidden before
    # that so the frontend can't peek at answers early.
    correct_index: Optional[int] = None


class Quiz(BaseModel):
    id: str
    learning_entry_id: Optional[str] = None
    subject: str
    questions: List[QuizQuestionPublic]
    completed: bool = False
    score: Optional[int] = None
    total: Optional[int] = None
    submitted_answers: Optional[List[int]] = None


class QuizSubmission(BaseModel):
    answers: List[int]


class QuizGenerateRequest(BaseModel):
    num_questions: int = DEFAULT_QUIZ_QUESTIONS
    difficulty: str = "medium"


class QuizResultItem(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    chosen_index: int
    is_correct: bool


class QuizResult(BaseModel):
    quiz_id: str
    score: int
    total: int
    results: List[QuizResultItem]
    points_earned: int = 0
    total_points: int = 0


class SubjectAccuracy(BaseModel):
    subject_id: Optional[str] = None
    subject: str
    correct: int
    total: int
    accuracy_percent: float


class ReviewTopic(BaseModel):
    topic: str
    subject: str
    miss_count: int


class RecentMiss(BaseModel):
    question: str
    subject: str
    subject_id: Optional[str] = None
    created_at: str


class ProgressStats(BaseModel):
    quizzes_completed: int
    questions_answered: int
    questions_correct: int
    accuracy_percent: Optional[float] = None
    day_streak: int = 0
    by_subject: List[SubjectAccuracy]
    topics_to_review: List[ReviewTopic]
    recent_misses: List[RecentMiss]


class Flashcard(BaseModel):
    front: str
    back: str


class PracticeDeck(BaseModel):
    subject_id: str
    subject: str
    unit: str
    cards: List[Flashcard]


class PracticeRequest(BaseModel):
    """Generate a small batch of practice cards (not an endless term dump)."""
    count: int = Field(default=5, ge=3, le=10)
    exclude_fronts: List[str] = Field(default_factory=list)


class ShopItem(BaseModel):
    id: str
    name: str
    emoji: str
    image: Optional[str] = None
    fullImage: Optional[str] = None
    price: int
    slot: str
    # Human-readable breakdown, e.g. "Pigtails · Hoodie · Shorts · Shoes"
    pieces: Optional[str] = None


class ShopState(BaseModel):
    points: int
    owned_item_ids: List[str]
    items: List[ShopItem]
    # Maps slot -> currently-equipped item id in that slot (or None), e.g.
    # {"head": "hat-frog", "face": "sunglasses"} — this is what AraAvatar
    # actually renders, so owning several hats doesn't stack them all on
    # her head at once.
    equipped: dict[str, Optional[str]]


class PurchaseRequest(BaseModel):
    item_id: str


class EquipRequest(BaseModel):
    item_id: str


class UnequipRequest(BaseModel):
    slot: str


class TeachTopic(BaseModel):
    topic: str
    subject: str
    subject_id: Optional[str] = None
    reason: str = "learning"  # "struggling" | "learning"


class TeachTopicsResponse(BaseModel):
    topics: List[TeachTopic]


class TeachStartRequest(BaseModel):
    topic: Optional[str] = None
    subject: Optional[str] = None
    subject_id: Optional[str] = None


class TeachReviewEntry(BaseModel):
    id: str
    subject: str
    unit: Optional[str] = None
    content: str
    created_at: str


class AraMemoryCard(BaseModel):
    topic: str
    subject: str
    summary: str


class TeachStartResponse(BaseModel):
    topic: str
    subject: str
    subject_id: Optional[str] = None
    message: str
    review_prompt: str = ""
    review_entry: Optional[TeachReviewEntry] = None
    past_memories: List[AraMemoryCard] = Field(default_factory=list)


class TeachChatTurn(BaseModel):
    role: str  # "user" | "ara"
    content: str


class TeachMessageRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    subject: str = Field(..., min_length=1, max_length=200)
    subject_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[TeachChatTurn] = Field(default_factory=list)


class TeachMessageResponse(BaseModel):
    status: str  # confused | clarify | understood
    message: str
    follow_up: str = ""
    lesson_summary: str = ""
    memory_saved: bool = False


class HomeworkChatTurn(BaseModel):
    role: str  # "user" | "ara"
    content: str


class HomeworkHelpRequest(BaseModel):
    question: str = Field(default="", max_length=4000)
    history: List[HomeworkChatTurn] = Field(default_factory=list)
    image_base64: Optional[str] = Field(default=None, max_length=6_000_000)
    image_mime: Optional[str] = Field(default=None, max_length=64)


class HomeworkHelpResponse(BaseModel):
    message: str
    follow_up: str = ""


def get_equipped_map(supabase: Client, user_id: str) -> dict:
    """Returns {slot: item_id} for every slot that currently has something
    equipped. Slots with nothing equipped are simply absent from the dict.
    Drops ids that are no longer in the catalog (retired items)."""
    response = (
        supabase.table("equipped_items")
        .select("slot, item_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {
        row["slot"]: row["item_id"]
        for row in response.data
        if row["item_id"] and row["item_id"] in SHOP_ITEMS_BY_ID
    }


def ensure_starter_items(supabase: Client, user_id: str) -> list[str]:
    """Grant free classic hair + outfit so players can always switch back."""
    purchases_response = (
        supabase.table("shop_purchases")
        .select("item_id")
        .eq("user_id", user_id)
        .execute()
    )
    owned = {row["item_id"] for row in purchases_response.data}
    for item_id in FREE_STARTER_ITEM_IDS:
        if item_id in owned:
            continue
        try:
            supabase.table("shop_purchases").insert(
                {"user_id": user_id, "item_id": item_id}
            ).execute()
            owned.add(item_id)
        except Exception:
            # Legacy DBs may still unique-constrain item_id globally.
            # Never fail shop/state — treat starters as owned for this user.
            owned.add(item_id)
    for item_id in FREE_STARTER_ITEM_IDS:
        owned.add(item_id)
    return list(owned)


def _unequip_slot(supabase: Client, user_id: str, slot: str) -> None:
    supabase.table("equipped_items").upsert(
        {"user_id": user_id, "slot": slot, "item_id": None},
        on_conflict="user_id,slot",
    ).execute()


def _equip_slot(supabase: Client, user_id: str, slot: str, item_id: str) -> None:
    supabase.table("equipped_items").upsert(
        {"user_id": user_id, "slot": slot, "item_id": item_id},
        on_conflict="user_id,slot",
    ).execute()


def _clear_clothing_slots(supabase: Client, user_id: str) -> None:
    """Only one complete look can be worn at a time."""
    for slot in CLOTHING_SLOTS:
        _unequip_slot(supabase, user_id, slot)


def _equip_complete_look(supabase: Client, user_id: str, item_id: str) -> None:
    _clear_clothing_slots(supabase, user_id)
    _equip_slot(supabase, user_id, "outfit", item_id)


def ensure_default_outfit(
    supabase: Client, user_id: str, equipped: dict
) -> dict:
    """Default look is Classic Lavender. Migrates old hair/top/pants equips."""
    if equipped.get("outfit"):
        return equipped

    # Prefer any legacy clothing slot as the active complete look.
    for slot in ("top", "hair", "pants", "head"):
        legacy_id = equipped.get(slot)
        if legacy_id and legacy_id in SHOP_ITEMS_BY_ID:
            _equip_complete_look(supabase, user_id, legacy_id)
            return get_equipped_map(supabase, user_id)

    ensure_starter_items(supabase, user_id)
    _equip_complete_look(supabase, user_id, CLASSIC_OUTFIT_ID)
    return get_equipped_map(supabase, user_id)


def get_or_create_stats_row(supabase: Client, user_id: str) -> dict:
    response = (
        supabase.table("user_stats")
        .select("user_id, points")
        .eq("user_id", user_id)
        .execute()
    )
    if response.data:
        return response.data[0]
    insert_response = (
        supabase.table("user_stats")
        .insert({"user_id": user_id, "points": 0})
        .execute()
    )
    return insert_response.data[0]


def build_shop_state(
    supabase: Client,
    user_id: str,
    *,
    stats: Optional[dict] = None,
    owned_item_ids: Optional[List[str]] = None,
    equipped: Optional[dict[str, Optional[str]]] = None,
) -> ShopState:
    stats = stats or get_or_create_stats_row(supabase, user_id)
    owned_item_ids = owned_item_ids or ensure_starter_items(supabase, user_id)
    equipped = equipped or get_equipped_map(supabase, user_id)
    equipped = ensure_default_outfit(supabase, user_id, equipped)
    return ShopState(
        points=stats["points"],
        owned_item_ids=owned_item_ids,
        items=[ShopItem(**item) for item in SHOP_CATALOG],
        equipped=equipped,
    )


def to_public_quiz(row: dict) -> Quiz:
    """Strips out correct_index unless the quiz is already completed — once
    it's submitted there's nothing left to cheat on, and the frontend needs
    the answers to redraw the graded quiz after a page refresh."""
    is_completed = row.get("completed_at") is not None
    public_questions = [
        QuizQuestionPublic(
            question=q["question"],
            options=q["options"],
            correct_index=q["correct_index"] if is_completed else None,
        )
        for q in row["questions"]
    ]
    return Quiz(
        id=row["id"],
        learning_entry_id=row.get("learning_entry_id"),
        subject=row["subject"],
        questions=public_questions,
        completed=is_completed,
        score=row.get("score"),
        total=row.get("total"),
        submitted_answers=row.get("submitted_answers"),
    )


def collect_misses_from_quizzes(quiz_rows: list) -> list:
    """Pull wrong answers out of completed quizzes."""
    misses = []
    for row in quiz_rows:
        if row.get("completed_at") is None:
            continue
        answers = row.get("submitted_answers") or []
        questions = row.get("questions") or []
        for question, chosen in zip(questions, answers):
            correct = question.get("correct_index")
            if correct is None or chosen == correct:
                continue
            misses.append(
                {
                    "question": question.get("question", ""),
                    "options": question.get("options") or [],
                    "correct_index": correct,
                    "subject": row.get("subject") or "Unknown",
                    "subject_id": row.get("subject_id"),
                    "created_at": row.get("created_at") or "",
                    "full_question": question,
                }
            )
    return misses


def learning_day_streak(entry_dates: list) -> int:
    """Count consecutive calendar days (ending today or yesterday) with a log."""
    if not entry_dates:
        return 0
    days = sorted(
        {
            datetime.fromisoformat(iso.replace("Z", "+00:00")).date()
            for iso in entry_dates
        },
        reverse=True,
    )
    today = date.today()
    if days[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    expected = days[0] - timedelta(days=1)
    for day in days[1:]:
        if day == expected:
            streak += 1
            expected = day - timedelta(days=1)
        elif day < expected:
            break
    return streak


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/progress", response_model=ProgressStats)
def get_progress(user_id: CurrentUserId):
    """Accuracy, weak topics, and recent misses — so Progress can show
    patterns, and so we know what next quizzes should lean on."""
    supabase = get_supabase()
    quizzes_response = (
        supabase.table("quizzes")
        .select(
            "id, subject_id, subject, questions, submitted_answers, "
            "score, total, completed_at, created_at"
        )
        .eq("user_id", user_id)
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(50)
        .execute()
    )
    quiz_rows = quizzes_response.data or []

    questions_answered = 0
    questions_correct = 0
    by_subject_counts: dict = {}

    for row in quiz_rows:
        total = row.get("total")
        score = row.get("score")
        if total is None or score is None:
            answers = row.get("submitted_answers") or []
            questions = row.get("questions") or []
            total = len(answers) if answers else len(questions)
            score = sum(
                1
                for question, chosen in zip(questions, answers)
                if chosen == question.get("correct_index")
            )
        questions_answered += total
        questions_correct += score
        subject = row.get("subject") or "Unknown"
        subject_id = row.get("subject_id")
        key = subject_id or subject
        bucket = by_subject_counts.setdefault(
            key,
            {
                "subject_id": subject_id,
                "subject": subject,
                "correct": 0,
                "total": 0,
            },
        )
        bucket["correct"] += score
        bucket["total"] += total

    by_subject = [
        SubjectAccuracy(
            subject_id=bucket["subject_id"],
            subject=bucket["subject"],
            correct=bucket["correct"],
            total=bucket["total"],
            accuracy_percent=round(100 * bucket["correct"] / bucket["total"], 1)
            if bucket["total"]
            else 0.0,
        )
        for bucket in by_subject_counts.values()
        if bucket["total"] > 0
    ]
    by_subject.sort(key=lambda item: item.accuracy_percent)

    misses = collect_misses_from_quizzes(quiz_rows[:MISS_LOOKBACK_QUIZZES])
    topics_raw = summarize_miss_topics(
        [{"question": m["question"], "subject": m["subject"]} for m in misses]
    )
    topics = [ReviewTopic(**topic) for topic in topics_raw]

    recent_misses = [
        RecentMiss(
            question=m["question"],
            subject=m["subject"],
            subject_id=m.get("subject_id"),
            created_at=m["created_at"],
        )
        for m in misses[:12]
    ]

    entries_response = (
        supabase.table("daily_learning_entries")
        .select("created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(60)
        .execute()
    )
    streak = learning_day_streak(
        [row["created_at"] for row in (entries_response.data or [])]
    )

    accuracy = (
        round(100 * questions_correct / questions_answered, 1)
        if questions_answered
        else None
    )

    return ProgressStats(
        quizzes_completed=len(quiz_rows),
        questions_answered=questions_answered,
        questions_correct=questions_correct,
        accuracy_percent=accuracy,
        day_streak=streak,
        by_subject=by_subject,
        topics_to_review=topics,
        recent_misses=recent_misses,
    )


@app.get("/subjects", response_model=List[Subject])
def list_subjects(user_id: CurrentUserId):
    supabase = get_supabase()
    response = (
        supabase.table("subjects")
        .select("id, name, unit, test_date, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [to_subject(row) for row in response.data]


@app.post("/subjects", response_model=Subject, status_code=201)
def create_subject(subject: SubjectCreate, user_id: CurrentUserId):
    supabase = get_supabase()
    test_date = None
    if subject.days_until_test is not None:
        test_date = (date.today() + timedelta(days=subject.days_until_test)).isoformat()

    response = (
        supabase.table("subjects")
        .insert(
            {
                "user_id": user_id,
                "name": subject.name.strip(),
                "unit": subject.unit.strip(),
                "test_date": test_date,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to save subject")
    return to_subject(response.data[0])


@app.get("/subjects/{subject_id}", response_model=Subject)
def get_subject(subject_id: str, user_id: CurrentUserId):
    supabase = get_supabase()
    response = (
        supabase.table("subjects")
        .select("id, name, unit, test_date, created_at")
        .eq("id", subject_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Subject not found")
    return to_subject(response.data)


@app.patch("/subjects/{subject_id}", response_model=Subject)
def update_subject(
    subject_id: str, body: SubjectUpdate, user_id: CurrentUserId
):
    supabase = get_supabase()
    existing = (
        supabase.table("subjects")
        .select("id, name, unit, test_date, created_at")
        .eq("id", subject_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subject not found")

    updates: dict = {}
    if body.unit is not None:
        updates["unit"] = body.unit.strip()

    if body.test_date is not None:
        try:
            parsed = date.fromisoformat(body.test_date)
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="test_date must be YYYY-MM-DD"
            ) from exc
        updates["test_date"] = parsed.isoformat()
    elif body.days_until_test is not None:
        updates["test_date"] = (
            date.today() + timedelta(days=body.days_until_test)
        ).isoformat()

    if not updates:
        return to_subject(existing.data)

    response = (
        supabase.table("subjects")
        .update(updates)
        .eq("id", subject_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update subject")
    return to_subject(response.data[0])


@app.post("/subjects/{subject_id}/practice", response_model=PracticeDeck)
def create_practice_deck(
    subject_id: str,
    user_id: CurrentUserId,
    body: PracticeRequest = PracticeRequest(),
):
    """Generate a small batch of practice cards from this subject's notes."""
    supabase = get_supabase()
    subject_response = (
        supabase.table("subjects")
        .select("id, name, unit, test_date, created_at")
        .eq("id", subject_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    subject = subject_response.data
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    entries_response = (
        supabase.table("daily_learning_entries")
        .select("content, created_at")
        .eq("subject_id", subject_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    entries = entries_response.data or []
    note_chunks = study_note_chunks(entries)
    if not note_chunks:
        raise HTTPException(
            status_code=400,
            detail="Log some notes in this subject before practicing.",
        )

    notes = "\n\n".join(note_chunks)
    exclude = [f.strip() for f in body.exclude_fronts if f and f.strip()]
    try:
        cards = generate_flashcards(
            subject["name"],
            notes,
            num_cards=body.count,
            avoid_fronts=exclude or None,
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    exclude_lower = {f.lower() for f in exclude}
    filtered = [
        card
        for card in cards
        if card["front"].strip().lower() not in exclude_lower
    ]

    return PracticeDeck(
        subject_id=subject["id"],
        subject=subject["name"],
        unit=subject["unit"],
        cards=[Flashcard(**card) for card in filtered],
    )


@app.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(subject_id: str, user_id: CurrentUserId):
    supabase = get_supabase()
    existing = (
        supabase.table("subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Clear related rows first (no DB cascade assumed).
    supabase.table("quizzes").delete().eq("subject_id", subject_id).eq(
        "user_id", user_id
    ).execute()
    supabase.table("daily_learning_entries").delete().eq(
        "subject_id", subject_id
    ).eq("user_id", user_id).execute()
    supabase.table("subjects").delete().eq("id", subject_id).eq(
        "user_id", user_id
    ).execute()
    return None


@app.get("/learning-entries", response_model=List[LearningEntry])
def list_learning_entries(user_id: CurrentUserId, subject_id: Optional[str] = None):
    supabase = get_supabase()
    query = (
        supabase.table("daily_learning_entries")
        .select("id, subject_id, subject, unit, content, created_at")
        .eq("user_id", user_id)
    )
    if subject_id:
        query = query.eq("subject_id", subject_id)
    response = query.order("created_at", desc=True).execute()
    return response.data


@app.post("/learning-entries", response_model=LearningEntry, status_code=201)
def create_learning_entry(entry: LearningEntryCreate, user_id: CurrentUserId):
    supabase = get_supabase()

    subject_response = (
        supabase.table("subjects")
        .select("id, name, unit")
        .eq("id", entry.subject_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    subject = subject_response.data
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # First log for this subject today earns shop points (the study prize).
    today = date.today()
    prior_today = (
        supabase.table("daily_learning_entries")
        .select("id, created_at")
        .eq("user_id", user_id)
        .eq("subject_id", subject["id"])
        .execute()
    )
    already_logged_today = any(
        date.fromisoformat(str(row["created_at"])[:10]) == today
        for row in (prior_today.data or [])
        if row.get("created_at")
    )

    response = (
        supabase.table("daily_learning_entries")
        .insert(
            {
                "user_id": user_id,
                "subject_id": subject["id"],
                # Storing the name + unit too (not just the id) means we
                # keep an accurate history even if the subject's current
                # unit changes later on.
                "subject": subject["name"],
                "unit": subject["unit"],
                "content": entry.content.strip(),
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to save entry")

    row = dict(response.data[0])
    points_earned = 0
    total_points = None
    if not already_logged_today:
        stats = get_or_create_stats_row(supabase, user_id)
        points_earned = POINTS_PER_LEARNING_ENTRY
        total_points = int(stats.get("points") or 0) + points_earned
        supabase.table("user_stats").update({"points": total_points}).eq(
            "user_id", user_id
        ).execute()

    return LearningEntry(
        id=row["id"],
        subject_id=row.get("subject_id"),
        subject=row["subject"],
        unit=row.get("unit"),
        content=row["content"],
        created_at=row["created_at"],
        points_earned=points_earned,
        total_points=total_points,
    )


@app.post("/learning-entries/explain", response_model=ExplainNotesResponse)
def explain_draft_notes(body: ExplainNotesRequest, user_id: CurrentUserId):
    """Ara explains draft learning-log notes in a short summary + how-to."""
    _ = user_id  # auth gate only — no DB row required for drafts
    result = explain_learning_notes(
        notes=body.content,
        subject=body.subject,
        unit=body.unit,
    )
    return ExplainNotesResponse(
        summary=result.get("summary", ""),
        how_to=result.get("how_to", ""),
        tip=result.get("tip", "") or "",
    )


@app.post("/learning-entries/from-image", response_model=NotesFromImageResponse)
def notes_from_image(body: NotesFromImageRequest, user_id: CurrentUserId):
    """Turn a pasted/uploaded notes photo into text for the learning log."""
    _ = user_id
    try:
        text = extract_notes_from_image(
            image_base64=body.image_base64,
            image_mime=body.image_mime,
            subject=body.subject,
            unit=body.unit,
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not (text or "").strip():
        raise HTTPException(
            status_code=422,
            detail="Couldn't read any notes from that photo. Try a clearer picture.",
        )
    return NotesFromImageResponse(content=text.strip())


@app.post(
    "/learning-entries/{entry_id}/explain",
    response_model=ExplainNotesResponse,
)
def explain_saved_entry(entry_id: str, user_id: CurrentUserId):
    """Ara explains a saved learning-log entry."""
    supabase = get_supabase()
    response = (
        supabase.table("daily_learning_entries")
        .select("id, subject, unit, content")
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    entry = response.data
    if not entry:
        raise HTTPException(status_code=404, detail="Learning entry not found")
    if is_no_new_learning(entry.get("content")):
        raise HTTPException(
            status_code=400,
            detail="Nothing new was logged today — open a past notes entry to explain.",
        )

    result = explain_learning_notes(
        notes=entry.get("content") or "",
        subject=entry.get("subject"),
        unit=entry.get("unit"),
    )
    return ExplainNotesResponse(
        summary=result.get("summary", ""),
        how_to=result.get("how_to", ""),
        tip=result.get("tip", "") or "",
    )


@app.get("/learning-entries/{entry_id}/quiz", response_model=Optional[Quiz])
def get_quiz_for_entry(entry_id: str, user_id: CurrentUserId):
    """Looks up the most recent quiz already generated for this entry, so the
    frontend can show it again after a page refresh instead of losing it."""
    supabase = get_supabase()
    response = (
        supabase.table("quizzes")
        .select("*")
        .eq("learning_entry_id", entry_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return to_public_quiz(response.data[0])


@app.post("/learning-entries/{entry_id}/quiz", response_model=Quiz, status_code=201)
def generate_quiz(
    entry_id: str,
    user_id: CurrentUserId,
    body: Optional[QuizGenerateRequest] = None,
):
    supabase = get_supabase()
    options = body or QuizGenerateRequest()

    total_questions = max(
        MIN_QUIZ_QUESTIONS, min(MAX_QUIZ_QUESTIONS, int(options.num_questions))
    )
    difficulty = (
        options.difficulty
        if options.difficulty in VALID_QUIZ_DIFFICULTIES
        else "medium"
    )
    max_review = min(MAX_REVIEW_QUESTIONS, max(0, total_questions // 3))
    max_miss_reuse = min(MAX_MISS_REUSE, max_review)

    entry_response = (
        supabase.table("daily_learning_entries")
        .select("id, subject_id, subject, unit, content")
        .eq("id", entry_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    entry = entry_response.data
    if not entry:
        raise HTTPException(status_code=404, detail="Learning entry not found")

    # Quiz covers today's new notes plus everything else logged for this
    # same subject + unit, so it reviews the whole unit, not just today.
    # "No new material" check-ins skip today's text and review past notes only.
    review_only = is_no_new_learning(entry.get("content"))
    past_chunks: list[str] = []
    if entry.get("subject_id"):
        past_query = (
            supabase.table("daily_learning_entries")
            .select("content, created_at, unit")
            .eq("subject_id", entry["subject_id"])
            .eq("user_id", user_id)
            .neq("id", entry["id"])
            .order("created_at", desc=True)
        )
        past_response = past_query.execute()
        past_rows = past_response.data or []
        # Prefer same unit; if empty (or review-only with no unit match), use all.
        if entry.get("unit"):
            same_unit = [
                row
                for row in past_rows
                if row.get("unit") == entry["unit"]
            ]
            past_chunks = study_note_chunks(same_unit)
        if not past_chunks:
            past_chunks = study_note_chunks(past_rows)

    if review_only:
        if not past_chunks:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No past notes to review yet. Log what you learned on "
                    "another day first, then you can quiz without new material."
                ),
            )
        notes = "\n\n".join(past_chunks)
    else:
        today_notes = (entry.get("content") or "").strip()
        notes = today_notes
        if past_chunks:
            notes = f"{today_notes}\n\n" + "\n\n".join(past_chunks) if today_notes else "\n\n".join(past_chunks)

    # Pattern watch: reuse recent misses for this subject, and tell Gemini
    # which topics / questions to lean on for the fresh questions.
    review_questions = []
    focus_misses: List[str] = []
    focus_topics: List[str] = []

    if entry.get("subject_id") and max_review > 0:
        recent_quizzes = (
            supabase.table("quizzes")
            .select(
                "questions, submitted_answers, completed_at, created_at, subject"
            )
            .eq("subject_id", entry["subject_id"])
            .eq("user_id", user_id)
            .not_.is_("completed_at", "null")
            .order("completed_at", desc=True)
            .limit(MISS_LOOKBACK_QUIZZES)
            .execute()
        )
        misses = collect_misses_from_quizzes(recent_quizzes.data or [])
        # Drop diary/meta misses so they are not reused or used as focus.
        content_misses = [
            m
            for m in misses
            if m.get("question") and not is_meta_quiz_question(m["question"])
        ]
        focus_misses = [m["question"] for m in content_misses]
        if content_misses:
            topics = summarize_miss_topics(
                [
                    {"question": m["question"], "subject": m["subject"]}
                    for m in content_misses
                ]
            )
            focus_topics = [t["topic"] for t in topics if t.get("topic")]

        # Prefer putting missed questions back on the quiz (content only).
        unique_miss_qs = []
        seen = set()
        for miss in content_misses:
            text = miss.get("question") or ""
            full = miss.get("full_question") or {}
            if not text or text in seen or is_meta_quiz_item(full):
                continue
            seen.add(text)
            unique_miss_qs.append(full)
        if unique_miss_qs and max_miss_reuse > 0:
            review_questions = random.sample(
                unique_miss_qs, k=min(max_miss_reuse, len(unique_miss_qs))
            )

        # If we still have review slots, fill with older spaced-repetition items.
        remaining_slots = max_review - len(review_questions)
        if remaining_slots > 0:
            cutoff = (
                datetime.now(timezone.utc) - timedelta(days=REVIEW_MIN_AGE_DAYS)
            ).isoformat()
            old_quizzes_response = (
                supabase.table("quizzes")
                .select("questions, created_at")
                .eq("subject_id", entry["subject_id"])
                .eq("user_id", user_id)
                .lte("created_at", cutoff)
                .execute()
            )
            reused_texts = {q.get("question") for q in review_questions}
            all_old_questions = [
                question
                for row in (old_quizzes_response.data or [])
                for question in row["questions"]
                if question.get("question")
                and question.get("question") not in reused_texts
                and not is_meta_quiz_item(question)
            ]
            if all_old_questions:
                review_questions.extend(
                    random.sample(
                        all_old_questions,
                        k=min(remaining_slots, len(all_old_questions)),
                    )
                )

    if len(review_questions) > total_questions:
        review_questions = random.sample(review_questions, total_questions)

    new_questions_needed = total_questions - len(review_questions)
    new_questions = []
    if new_questions_needed > 0:
        try:
            new_questions = generate_quiz_questions(
                entry["subject"],
                notes,
                num_questions=new_questions_needed,
                difficulty=difficulty,
                focus_misses=focus_misses or None,
                focus_topics=focus_topics or None,
            )
        except QuizGenerationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    combined_questions = new_questions + review_questions
    # Last line of defense: never ship diary/meta questions to the client.
    combined_questions = [
        q
        for q in combined_questions
        if not is_meta_quiz_item(q)
    ]

    # If filtering removed too many, generate fresh content questions to fill.
    shortfall = total_questions - len(combined_questions)
    if shortfall > 0:
        try:
            extras = generate_quiz_questions(
                entry["subject"],
                notes,
                num_questions=shortfall,
                difficulty=difficulty,
                focus_misses=focus_misses or None,
                focus_topics=focus_topics or None,
            )
            for q in extras:
                if is_meta_quiz_item(q):
                    continue
                combined_questions.append(q)
                if len(combined_questions) >= total_questions:
                    break
        except QuizGenerationError:
            pass

    # Keep the quiz at the requested size even if Gemini returns extras.
    if len(combined_questions) > total_questions:
        combined_questions = combined_questions[:total_questions]
    random.shuffle(combined_questions)

    if not combined_questions:
        raise HTTPException(
            status_code=502,
            detail="Couldn't build content quiz questions. Try again.",
        )

    insert_response = (
        supabase.table("quizzes")
        .insert(
            {
                "user_id": user_id,
                "learning_entry_id": entry["id"],
                "subject_id": entry.get("subject_id"),
                "subject": entry["subject"],
                "questions": combined_questions,
            }
        )
        .execute()
    )
    if not insert_response.data:
        raise HTTPException(status_code=500, detail="Failed to save quiz")

    return to_public_quiz(insert_response.data[0])


@app.get("/quizzes/{quiz_id}", response_model=Quiz)
def get_quiz(quiz_id: str, user_id: CurrentUserId):
    supabase = get_supabase()
    response = (
        supabase.table("quizzes")
        .select("*")
        .eq("id", quiz_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return to_public_quiz(response.data)


@app.post("/quizzes/{quiz_id}/submit", response_model=QuizResult)
def submit_quiz(quiz_id: str, submission: QuizSubmission, user_id: CurrentUserId):
    supabase = get_supabase()
    quiz_response = (
        supabase.table("quizzes")
        .select("*")
        .eq("id", quiz_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    quiz_row = quiz_response.data
    if not quiz_row:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = quiz_row["questions"]
    if len(submission.answers) != len(questions):
        raise HTTPException(
            status_code=400,
            detail=f"Expected {len(questions)} answers, got {len(submission.answers)}",
        )

    results: List[QuizResultItem] = []
    score = 0
    for question, chosen_index in zip(questions, submission.answers):
        is_correct = chosen_index == question["correct_index"]
        if is_correct:
            score += 1
        results.append(
            QuizResultItem(
                question=question["question"],
                options=question["options"],
                correct_index=question["correct_index"],
                chosen_index=chosen_index,
                is_correct=is_correct,
            )
        )

    total = len(questions)
    supabase.table("quizzes").update(
        {
            "submitted_answers": submission.answers,
            "score": score,
            "total": total,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", quiz_id).eq("user_id", user_id).execute()

    points_earned = score * POINTS_PER_CORRECT_ANSWER
    stats = get_or_create_stats_row(supabase, user_id)
    total_points = stats["points"] + points_earned
    supabase.table("user_stats").update({"points": total_points}).eq(
        "user_id", user_id
    ).execute()

    return QuizResult(
        quiz_id=quiz_id,
        score=score,
        total=total,
        results=results,
        points_earned=points_earned,
        total_points=total_points,
    )


@app.get("/shop/state", response_model=ShopState)
def get_shop_state(user_id: CurrentUserId):
    supabase = get_supabase()
    return build_shop_state(supabase, user_id)


@app.post("/shop/purchase", response_model=ShopState)
def purchase_item(purchase: PurchaseRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    item = next((i for i in SHOP_CATALOG if i["id"] == purchase.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    stats = get_or_create_stats_row(supabase, user_id)
    owned_item_ids = ensure_starter_items(supabase, user_id)
    if purchase.item_id in owned_item_ids:
        raise HTTPException(status_code=400, detail="You already own this item")
    if stats["points"] < item["price"]:
        raise HTTPException(status_code=400, detail="Not enough points")

    new_points = stats["points"] - item["price"]
    supabase.table("user_stats").update({"points": new_points}).eq(
        "user_id", user_id
    ).execute()
    supabase.table("shop_purchases").insert(
        {"user_id": user_id, "item_id": purchase.item_id}
    ).execute()
    owned_item_ids.append(purchase.item_id)

    # Auto-equip bought complete looks only (not themes / accessories).
    equipped = get_equipped_map(supabase, user_id)
    should_auto_equip = item.get("slot") == "outfit" and (
        item["id"] in FREE_STARTER_ITEM_IDS or "outfit" not in equipped
    )
    if should_auto_equip:
        _equip_complete_look(supabase, user_id, item["id"])
        equipped = get_equipped_map(supabase, user_id)

    stats = get_or_create_stats_row(supabase, user_id)
    stats = {**stats, "points": new_points}
    return build_shop_state(
        supabase,
        user_id,
        stats=stats,
        owned_item_ids=owned_item_ids,
        equipped=equipped,
    )


@app.post("/shop/equip", response_model=ShopState)
def equip_item(equip: EquipRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    item = SHOP_ITEMS_BY_ID.get(equip.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    owned_item_ids = ensure_starter_items(supabase, user_id)
    if (
        equip.item_id not in owned_item_ids
        and equip.item_id not in FREE_STARTER_ITEM_IDS
    ):
        raise HTTPException(status_code=400, detail="You don't own this item yet")

    if item.get("slot") != "outfit":
        raise HTTPException(
            status_code=400,
            detail="Only complete outfits can be worn. Themes unlock in Ara options.",
        )

    _equip_complete_look(supabase, user_id, item["id"])

    return build_shop_state(
        supabase, user_id, owned_item_ids=owned_item_ids
    )


@app.post("/shop/unequip", response_model=ShopState)
def unequip_item(unequip: UnequipRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    _unequip_slot(supabase, user_id, unequip.slot)

    owned_item_ids = ensure_starter_items(supabase, user_id)
    equipped = get_equipped_map(supabase, user_id)
    # Taking off the active look falls back to Classic Lavender.
    if unequip.slot in CLOTHING_SLOTS:
        equipped = ensure_default_outfit(supabase, user_id, equipped)

    return build_shop_state(
        supabase,
        user_id,
        owned_item_ids=owned_item_ids,
        equipped=equipped,
    )


def _notes_for_subject(
    supabase: Client, user_id: str, subject_id: Optional[str], subject_name: str
) -> str:
    query = (
        supabase.table("daily_learning_entries")
        .select("content, subject, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(6)
    )
    if subject_id:
        query = query.eq("subject_id", subject_id)
    else:
        query = query.eq("subject", subject_name)
    rows = query.execute().data or []
    return "\n\n".join(
        (row.get("content") or "").strip() for row in rows if row.get("content")
    )


def _pick_review_entry(
    supabase: Client,
    user_id: str,
    subject_id: Optional[str],
    subject_name: str,
    topic: str,
) -> Optional[dict]:
    """Pick one notes entry for the student to review before teaching Ara."""
    query = (
        supabase.table("daily_learning_entries")
        .select("id, subject, unit, content, created_at, subject_id")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
    )
    if subject_id:
        query = query.eq("subject_id", subject_id)
    else:
        query = query.eq("subject", subject_name)
    rows = [r for r in (query.execute().data or []) if (r.get("content") or "").strip()]
    if not rows:
        # Fall back to any recent notes for this user.
        rows = [
            r
            for r in (
                supabase.table("daily_learning_entries")
                .select("id, subject, unit, content, created_at, subject_id")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
                .data
                or []
            )
            if (r.get("content") or "").strip()
        ]
    if not rows:
        return None

    topic_words = [
        w for w in topic.lower().replace("/", " ").replace("-", " ").split() if len(w) > 2
    ]

    def score(row: dict) -> tuple:
        text = f"{row.get('unit') or ''} {row.get('content') or ''}".lower()
        hits = sum(1 for w in topic_words if w in text)
        return (hits, row.get("created_at") or "")

    rows.sort(key=score, reverse=True)
    return rows[0]


def _teach_topic_choices(user_id: str) -> list[TeachTopic]:
    """Prefer weak quiz topics; fall back to recent learning subjects/units."""
    supabase = get_supabase()
    topics: list[TeachTopic] = []
    seen: set[tuple[str, str]] = set()

    quizzes_response = (
        supabase.table("quizzes")
        .select(
            "id, subject_id, subject, questions, submitted_answers, completed_at"
        )
        .eq("user_id", user_id)
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(MISS_LOOKBACK_QUIZZES)
        .execute()
    )
    misses = collect_misses_from_quizzes(quizzes_response.data or [])
    for row in summarize_miss_topics(
        [{"question": m["question"], "subject": m["subject"]} for m in misses]
    ):
        key = (row["topic"].lower(), row["subject"].lower())
        if key in seen:
            continue
        seen.add(key)
        subject_id = next(
            (
                m.get("subject_id")
                for m in misses
                if (m.get("subject") or "") == row["subject"]
            ),
            None,
        )
        topics.append(
            TeachTopic(
                topic=row["topic"],
                subject=row["subject"],
                subject_id=subject_id,
                reason="struggling",
            )
        )

    entries = (
        supabase.table("daily_learning_entries")
        .select("subject_id, subject, unit, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(12)
        .execute()
        .data
        or []
    )
    for row in entries:
        subject = (row.get("subject") or "").strip() or "General"
        unit = (row.get("unit") or "").strip()
        topic = unit if unit else f"What I learned in {subject}"
        key = (topic.lower(), subject.lower())
        if key in seen:
            continue
        seen.add(key)
        topics.append(
            TeachTopic(
                topic=topic,
                subject=subject,
                subject_id=row.get("subject_id"),
                reason="learning",
            )
        )

    subjects = (
        supabase.table("subjects")
        .select("id, name, unit")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(8)
        .execute()
        .data
        or []
    )
    for row in subjects:
        subject = (row.get("name") or "").strip()
        unit = (row.get("unit") or "").strip()
        if not subject:
            continue
        topic = unit or subject
        key = (topic.lower(), subject.lower())
        if key in seen:
            continue
        seen.add(key)
        topics.append(
            TeachTopic(
                topic=topic,
                subject=subject,
                subject_id=row.get("id"),
                reason="learning",
            )
        )

    return topics[:12]


def _load_ara_memories(
    supabase: Client,
    user_id: str,
    subject: Optional[str] = None,
    subject_id: Optional[str] = None,
    limit: int = 8,
) -> list[dict]:
    """Recent lesson memories for this user, preferring the current subject."""
    try:
        query = (
            supabase.table("ara_memories")
            .select("topic, subject, summary, created_at, subject_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(40)
        )
        rows = query.execute().data or []
    except Exception:
        # Table may not exist until migration 004 is run.
        return []

    if not rows:
        return []

    preferred = []
    others = []
    subject_key = (subject or "").strip().lower()
    for row in rows:
        if subject_id and row.get("subject_id") == subject_id:
            preferred.append(row)
        elif subject_key and (row.get("subject") or "").strip().lower() == subject_key:
            preferred.append(row)
        else:
            others.append(row)
    return (preferred + others)[:limit]


def _save_ara_memory(
    supabase: Client,
    user_id: str,
    subject: str,
    topic: str,
    summary: str,
    subject_id: Optional[str] = None,
) -> bool:
    summary = (summary or "").strip()
    if not summary:
        return False
    payload = {
        "user_id": user_id,
        "subject": subject.strip(),
        "topic": topic.strip(),
        "summary": summary[:600],
        "source": "teach_ara",
    }
    if subject_id:
        payload["subject_id"] = subject_id
    try:
        supabase.table("ara_memories").insert(payload).execute()
        return True
    except Exception:
        return False


@app.get("/teach-ara/topics", response_model=TeachTopicsResponse)
def list_teach_topics(user_id: CurrentUserId):
    return TeachTopicsResponse(topics=_teach_topic_choices(user_id))


@app.post("/teach-ara/start", response_model=TeachStartResponse)
def start_teach_ara(body: TeachStartRequest, user_id: CurrentUserId):
    choices = _teach_topic_choices(user_id)
    picked: Optional[TeachTopic] = None
    if body.topic and body.subject:
        picked = TeachTopic(
            topic=body.topic.strip(),
            subject=body.subject.strip(),
            subject_id=body.subject_id,
            reason="learning",
        )
    elif choices:
        # Prefer struggling topics when available.
        struggling = [t for t in choices if t.reason == "struggling"]
        pool = struggling or choices
        picked = random.choice(pool)
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "Add a subject or some notes first — then Ara will have "
                "something to learn from you."
            ),
        )

    supabase = get_supabase()
    notes = _notes_for_subject(
        supabase, user_id, picked.subject_id, picked.subject
    )
    memories = _load_ara_memories(
        supabase,
        user_id,
        subject=picked.subject,
        subject_id=picked.subject_id,
    )
    review_row = _pick_review_entry(
        supabase, user_id, picked.subject_id, picked.subject, picked.topic
    )
    try:
        message = teach_ara_opener(
            picked.subject, picked.topic, notes, memories=memories
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    review_entry = None
    review_prompt = ""
    if review_row:
        review_entry = TeachReviewEntry(
            id=review_row["id"],
            subject=review_row.get("subject") or picked.subject,
            unit=review_row.get("unit"),
            content=(review_row.get("content") or "").strip(),
            created_at=review_row.get("created_at") or "",
        )
        review_prompt = (
            f"Before you teach me about {picked.topic}, review this notes "
            f"entry first. When you're ready, close it and explain it to me "
            f"in your own words!"
        )

    past_memories = [
        AraMemoryCard(
            topic=row.get("topic") or "",
            subject=row.get("subject") or "",
            summary=row.get("summary") or "",
        )
        for row in memories
        if row.get("topic") and row.get("summary")
    ]

    return TeachStartResponse(
        topic=picked.topic,
        subject=picked.subject,
        subject_id=picked.subject_id,
        message=message,
        review_prompt=review_prompt,
        review_entry=review_entry,
        past_memories=past_memories,
    )


@app.post("/teach-ara/message", response_model=TeachMessageResponse)
def message_teach_ara(body: TeachMessageRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    notes = _notes_for_subject(
        supabase, user_id, body.subject_id, body.subject
    )
    memories = _load_ara_memories(
        supabase,
        user_id,
        subject=body.subject,
        subject_id=body.subject_id,
    )
    history = [
        {"role": turn.role, "content": turn.content}
        for turn in body.history
        if turn.role in ("user", "ara") and turn.content.strip()
    ]
    try:
        result = teach_ara_reply(
            subject=body.subject,
            topic=body.topic,
            user_message=body.message,
            history=history,
            notes=notes,
            memories=memories,
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    lesson_summary = result.get("lesson_summary") or ""
    memory_saved = False
    if result.get("status") == "understood" and lesson_summary:
        memory_saved = _save_ara_memory(
            supabase,
            user_id=user_id,
            subject=body.subject,
            topic=body.topic,
            summary=lesson_summary,
            subject_id=body.subject_id,
        )

    return TeachMessageResponse(
        status=result["status"],
        message=result["message"],
        follow_up=result.get("follow_up") or "",
        lesson_summary=lesson_summary if memory_saved else "",
        memory_saved=memory_saved,
    )


@app.post("/homework/help", response_model=HomeworkHelpResponse)
def homework_help(body: HomeworkHelpRequest, user_id: CurrentUserId):
    question = (body.question or "").strip()
    has_image = bool(body.image_base64 and body.image_mime)
    if not question and not has_image:
        raise HTTPException(
            status_code=400,
            detail="Type a question or attach a homework photo.",
        )

    history = [
        {"role": turn.role, "content": turn.content}
        for turn in body.history
        if turn.role in ("user", "ara") and turn.content.strip()
    ]
    try:
        result = homework_help_reply(
            question=question,
            history=history,
            image_base64=body.image_base64,
            image_mime=body.image_mime,
        )
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return HomeworkHelpResponse(
        message=result["message"],
        follow_up=result.get("follow_up") or "",
    )


if __name__ == "__main__":
    import uvicorn

    # reload=True is turned off: on this Windows + Python 3.14 setup it
    # sometimes crashes when restarting after a file change. If you edit
    # backend code, stop this (Ctrl+C) and run `python main.py` again.
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
