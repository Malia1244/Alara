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
    generate_flashcards,
    generate_quiz_questions,
    summarize_miss_topics,
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


# Quiz shape: 8 questions total. Prefer recently missed questions for
# review, then older spaced-repetition items, with the rest freshly
# generated (and focused on weak topics when we have them).
TOTAL_QUIZ_QUESTIONS = 8
MAX_REVIEW_QUESTIONS = 3
MAX_MISS_REUSE = 3
REVIEW_MIN_AGE_DAYS = 7
# How far back we look when spotting miss patterns for the next quiz /
# progress page.
MISS_LOOKBACK_QUIZZES = 12

# Every correct quiz answer earns this many points, which can be spent in
# the shop. There's only one "profile" for now (no accounts yet), so we
# keep a single row in user_stats to track the running total.
POINTS_PER_CORRECT_ANSWER = 10

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
SHOP_CATALOG = [
    {"id": "bow", "name": "Purple Bow", "emoji": "🎀", "image": None, "fullImage": None, "price": 50, "slot": "head"},
    {"id": "sunglasses", "name": "Cool Sunglasses", "emoji": "🕶️", "image": None, "fullImage": None, "price": 80, "slot": "face"},
    {"id": "backpack", "name": "Star Backpack", "emoji": "🎒", "image": None, "fullImage": None, "price": 100, "slot": "back"},
    {"id": "scarf", "name": "Cozy Scarf", "emoji": "🧣", "image": None, "fullImage": None, "price": 120, "slot": "neck"},
    {"id": "sparkles", "name": "Sparkle Effect", "emoji": "✨", "image": None, "fullImage": None, "price": 150, "slot": "effect"},
    {"id": "partyhat", "name": "Party Hat", "emoji": "🎉", "image": None, "fullImage": None, "price": 200, "slot": "head"},
    {"id": "hat-leopard", "name": "Leopard Print Bucket Hat", "emoji": "🐆", "image": "hat-leopard.png", "fullImage": "hat-leopard.png", "price": 90, "slot": "head"},
    {"id": "hat-plaid-brown", "name": "Plaid Bucket Hat", "emoji": "🧢", "image": "hat-plaid-brown.png", "fullImage": "hat-plaid-brown.png", "price": 90, "slot": "head"},
    {"id": "hat-shadow", "name": "Mystery Bucket Hat", "emoji": "🕵️", "image": "hat-shadow.png", "fullImage": "hat-shadow.png", "price": 90, "slot": "head"},
    {"id": "hat-frog", "name": "Froggy Bucket Hat", "emoji": "🐸", "image": "hat-frog.png", "fullImage": "hat-frog.png", "price": 110, "slot": "head"},
    {"id": "hat-cow-pink", "name": "Pink Cow Print Bucket Hat", "emoji": "🐄", "image": "hat-cow-pink.png", "fullImage": "hat-cow-pink.png", "price": 100, "slot": "head"},
    {"id": "hat-bunny", "name": "Bunny Cutie Bucket Hat", "emoji": "🐰", "image": "hat-bunny.png", "fullImage": "hat-bunny.png", "price": 120, "slot": "head"},
    {"id": "hat-smiley", "name": "Smiley Bucket Hat", "emoji": "😊", "image": "hat-smiley.png", "fullImage": "hat-smiley.png", "price": 100, "slot": "head"},
    {"id": "hat-doodle", "name": "Doodle Bucket Hat", "emoji": "✏️", "image": "hat-doodle.png", "fullImage": "hat-doodle.png", "price": 80, "slot": "head"},
    {"id": "hat-frogpatch", "name": "Frog Patch Bucket Hat", "emoji": "🐸", "image": "hat-frogpatch.png", "fullImage": "hat-frogpatch.png", "price": 90, "slot": "head"},
    {"id": "hat-cow-bw", "name": "Cow Print Bucket Hat", "emoji": "🐄", "image": "hat-cow-bw.png", "fullImage": "hat-cow-bw.png", "price": 100, "slot": "head"},
    # Tops — each is its own item (not bundled into an outfit). fullImage swaps
    # Ara's whole portrait so the shirt looks properly worn. Slot "top" is
    # separate from "head" so a hat and a top can both be equipped at once.
    {"id": "top-stripe-pink", "name": "Pink Stripe Sweater", "emoji": "👚", "image": "top-stripe-pink.png", "fullImage": "top-stripe-pink.png", "price": 110, "slot": "top"},
    {"id": "top-bow-tee", "name": "Pink Bow Tee", "emoji": "🎀", "image": "top-bow-tee.png", "fullImage": "top-bow-tee.png", "price": 90, "slot": "top"},
    {"id": "top-cloud-tee", "name": "Cloud & Stars Tee", "emoji": "☁️", "image": "top-cloud-tee.png", "fullImage": "top-cloud-tee.png", "price": 95, "slot": "top"},
    {"id": "top-bear-cardigan", "name": "Bear Patch Cardigan", "emoji": "🧸", "image": "top-bear-cardigan.png", "fullImage": "top-bear-cardigan.png", "price": 130, "slot": "top"},
    {"id": "top-ok-hoodie", "name": "OK Hoodie", "emoji": "⭐", "image": "top-ok-hoodie.png", "fullImage": "top-ok-hoodie.png", "price": 120, "slot": "top"},
    {"id": "top-strawberry-hoodie", "name": "Strawberry Zip Hoodie", "emoji": "🍓", "image": "top-strawberry-hoodie.png", "fullImage": "top-strawberry-hoodie.png", "price": 125, "slot": "top"},
    {"id": "top-denim-jacket", "name": "Flower Denim Jacket", "emoji": "👖", "image": "top-denim-jacket.png", "fullImage": "top-denim-jacket.png", "price": 140, "slot": "top"},
    {"id": "top-floral-cardigan", "name": "Floral Cardigan", "emoji": "🌸", "image": "top-floral-cardigan.png", "fullImage": "top-floral-cardigan.png", "price": 135, "slot": "top"},
    {"id": "top-cherry-tee", "name": "Cherry Tee", "emoji": "🍒", "image": "top-cherry-tee.png", "fullImage": "top-cherry-tee.png", "price": 90, "slot": "top"},
    {"id": "top-sunny-tee", "name": "Sunny Tee", "emoji": "☀️", "image": "top-sunny-tee.png", "fullImage": "top-sunny-tee.png", "price": 100, "slot": "top"},
]

SHOP_ITEMS_BY_ID = {item["id"]: item for item in SHOP_CATALOG}

app = FastAPI(title="Alara API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SubjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    unit: str = Field(..., min_length=1, max_length=200)
    days_until_test: Optional[int] = Field(default=None, ge=0)


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


class ShopItem(BaseModel):
    id: str
    name: str
    emoji: str
    image: Optional[str] = None
    fullImage: Optional[str] = None
    price: int
    slot: str


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


def get_equipped_map(supabase: Client, user_id: str) -> dict:
    """Returns {slot: item_id} for every slot that currently has something
    equipped. Slots with nothing equipped are simply absent from the dict."""
    response = (
        supabase.table("equipped_items")
        .select("slot, item_id")
        .eq("user_id", user_id)
        .execute()
    )
    return {row["slot"]: row["item_id"] for row in response.data if row["item_id"]}


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


@app.post("/subjects/{subject_id}/practice", response_model=PracticeDeck)
def create_practice_deck(subject_id: str, user_id: CurrentUserId):
    """Build a flashcard deck from everything logged for this subject."""
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
    if not entries:
        raise HTTPException(
            status_code=400,
            detail="Log some notes in this subject before practicing.",
        )

    notes = "\n\n".join(row["content"] for row in entries)
    try:
        cards = generate_flashcards(subject["name"], notes, num_cards=10)
    except QuizGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return PracticeDeck(
        subject_id=subject["id"],
        subject=subject["name"],
        unit=subject["unit"],
        cards=[Flashcard(**card) for card in cards],
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
    return response.data[0]


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
def generate_quiz(entry_id: str, user_id: CurrentUserId):
    supabase = get_supabase()

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
    notes = entry["content"]
    if entry.get("subject_id") and entry.get("unit"):
        unit_entries_response = (
            supabase.table("daily_learning_entries")
            .select("content, created_at")
            .eq("subject_id", entry["subject_id"])
            .eq("user_id", user_id)
            .eq("unit", entry["unit"])
            .neq("id", entry["id"])
            .order("created_at", desc=True)
            .execute()
        )
        other_notes = "\n\n".join(
            row["content"] for row in unit_entries_response.data
        )
        if other_notes:
            notes = f"{notes}\n\n{other_notes}"

    # Pattern watch: reuse recent misses for this subject, and tell Gemini
    # which topics / questions to lean on for the fresh questions.
    review_questions = []
    focus_misses: List[str] = []
    focus_topics: List[str] = []

    if entry.get("subject_id"):
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
        focus_misses = [m["question"] for m in misses if m.get("question")]
        if misses:
            topics = summarize_miss_topics(
                [
                    {"question": m["question"], "subject": m["subject"]}
                    for m in misses
                ]
            )
            focus_topics = [t["topic"] for t in topics if t.get("topic")]

        # Prefer putting missed questions back on the quiz.
        unique_miss_qs = []
        seen = set()
        for miss in misses:
            text = miss.get("question") or ""
            if not text or text in seen:
                continue
            seen.add(text)
            unique_miss_qs.append(miss["full_question"])
        if unique_miss_qs:
            review_questions = random.sample(
                unique_miss_qs, k=min(MAX_MISS_REUSE, len(unique_miss_qs))
            )

        # If we still have review slots, fill with older spaced-repetition items.
        remaining_slots = MAX_REVIEW_QUESTIONS - len(review_questions)
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
                if question.get("question") not in reused_texts
            ]
            if all_old_questions:
                review_questions.extend(
                    random.sample(
                        all_old_questions,
                        k=min(remaining_slots, len(all_old_questions)),
                    )
                )

    new_questions_needed = TOTAL_QUIZ_QUESTIONS - len(review_questions)
    new_questions = []
    if new_questions_needed > 0:
        try:
            new_questions = generate_quiz_questions(
                entry["subject"],
                notes,
                num_questions=new_questions_needed,
                focus_misses=focus_misses or None,
                focus_topics=focus_topics or None,
            )
        except QuizGenerationError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    combined_questions = new_questions + review_questions
    random.shuffle(combined_questions)

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
    stats = get_or_create_stats_row(supabase, user_id)
    purchases_response = (
        supabase.table("shop_purchases")
        .select("item_id")
        .eq("user_id", user_id)
        .execute()
    )
    owned_item_ids = [row["item_id"] for row in purchases_response.data]
    return ShopState(
        points=stats["points"],
        owned_item_ids=owned_item_ids,
        items=[ShopItem(**item) for item in SHOP_CATALOG],
        equipped=get_equipped_map(supabase, user_id),
    )


@app.post("/shop/purchase", response_model=ShopState)
def purchase_item(purchase: PurchaseRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    item = next((i for i in SHOP_CATALOG if i["id"] == purchase.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    stats = get_or_create_stats_row(supabase, user_id)
    purchases_response = (
        supabase.table("shop_purchases")
        .select("item_id")
        .eq("user_id", user_id)
        .execute()
    )
    owned_item_ids = [row["item_id"] for row in purchases_response.data]
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

    # Auto-equip a freshly bought item if that slot is empty so far — nice
    # for slots like "face" or "neck" that (for now) only ever have one
    # item in them, so buying it just works with no extra step.
    equipped = get_equipped_map(supabase, user_id)
    if item["slot"] not in equipped:
        supabase.table("equipped_items").upsert(
            {"user_id": user_id, "slot": item["slot"], "item_id": item["id"]},
            on_conflict="user_id,slot",
        ).execute()
        equipped[item["slot"]] = item["id"]

    return ShopState(
        points=new_points,
        owned_item_ids=owned_item_ids,
        items=[ShopItem(**i) for i in SHOP_CATALOG],
        equipped=equipped,
    )


@app.post("/shop/equip", response_model=ShopState)
def equip_item(equip: EquipRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    item = SHOP_ITEMS_BY_ID.get(equip.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    purchases_response = (
        supabase.table("shop_purchases")
        .select("item_id")
        .eq("user_id", user_id)
        .execute()
    )
    owned_item_ids = [row["item_id"] for row in purchases_response.data]
    if equip.item_id not in owned_item_ids:
        raise HTTPException(status_code=400, detail="You don't own this item yet")

    supabase.table("equipped_items").upsert(
        {"user_id": user_id, "slot": item["slot"], "item_id": item["id"]},
        on_conflict="user_id,slot",
    ).execute()

    stats = get_or_create_stats_row(supabase, user_id)
    return ShopState(
        points=stats["points"],
        owned_item_ids=owned_item_ids,
        items=[ShopItem(**i) for i in SHOP_CATALOG],
        equipped=get_equipped_map(supabase, user_id),
    )


@app.post("/shop/unequip", response_model=ShopState)
def unequip_item(unequip: UnequipRequest, user_id: CurrentUserId):
    supabase = get_supabase()
    supabase.table("equipped_items").upsert(
        {"user_id": user_id, "slot": unequip.slot, "item_id": None},
        on_conflict="user_id,slot",
    ).execute()

    stats = get_or_create_stats_row(supabase, user_id)
    purchases_response = (
        supabase.table("shop_purchases")
        .select("item_id")
        .eq("user_id", user_id)
        .execute()
    )
    owned_item_ids = [row["item_id"] for row in purchases_response.data]
    return ShopState(
        points=stats["points"],
        owned_item_ids=owned_item_ids,
        items=[ShopItem(**i) for i in SHOP_CATALOG],
        equipped=get_equipped_map(supabase, user_id),
    )


if __name__ == "__main__":
    import uvicorn

    # reload=True is turned off: on this Windows + Python 3.14 setup it
    # sometimes crashes when restarting after a file change. If you edit
    # backend code, stop this (Ctrl+C) and run `python main.py` again.
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
