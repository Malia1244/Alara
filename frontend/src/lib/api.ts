import { supabase } from "@/lib/supabase";

export type Subject = {
  id: string;
  name: string;
  unit: string;
  test_date: string | null;
  days_until_test: number | null;
  created_at: string;
};

export type LearningEntry = {
  id: string;
  subject_id: string | null;
  subject: string;
  unit: string | null;
  content: string;
  created_at: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number | null;
};

export type Quiz = {
  id: string;
  learning_entry_id: string | null;
  subject: string;
  questions: QuizQuestion[];
  completed: boolean;
  score: number | null;
  total: number | null;
  submitted_answers: number[] | null;
};

export type QuizResultItem = {
  question: string;
  options: string[];
  correct_index: number;
  chosen_index: number;
  is_correct: boolean;
};

export type QuizResult = {
  quiz_id: string;
  score: number;
  total: number;
  results: QuizResultItem[];
  points_earned: number;
  total_points: number;
};

export type ShopItem = {
  id: string;
  name: string;
  emoji: string;
  image: string | null;
  fullImage: string | null;
  price: number;
  slot: string;
  /** Hair · top · bottoms · shoes breakdown for complete looks */
  pieces?: string | null;
};

export type ShopState = {
  points: number;
  owned_item_ids: string[];
  items: ShopItem[];
  equipped: Record<string, string | null>;
};

export type SubjectAccuracy = {
  subject_id: string | null;
  subject: string;
  correct: number;
  total: number;
  accuracy_percent: number;
};

export type ReviewTopic = {
  topic: string;
  subject: string;
  miss_count: number;
};

export type RecentMiss = {
  question: string;
  subject: string;
  subject_id: string | null;
  created_at: string;
};

export type ProgressStats = {
  quizzes_completed: number;
  questions_answered: number;
  questions_correct: number;
  accuracy_percent: number | null;
  day_streak: number;
  by_subject: SubjectAccuracy[];
  topics_to_review: ReviewTopic[];
  recent_misses: RecentMiss[];
};

export type Flashcard = {
  front: string;
  back: string;
};

export type PracticeDeck = {
  subject_id: string;
  subject: string;
  unit: string;
  cards: Flashcard[];
};

export type TeachTopic = {
  topic: string;
  subject: string;
  subject_id: string | null;
  reason: "struggling" | "learning" | string;
};

export type TeachReviewEntry = {
  id: string;
  subject: string;
  unit: string | null;
  content: string;
  created_at: string;
};

export type AraMemoryCard = {
  topic: string;
  subject: string;
  summary: string;
};

export type TeachStart = {
  topic: string;
  subject: string;
  subject_id: string | null;
  message: string;
  review_prompt: string;
  review_entry: TeachReviewEntry | null;
  past_memories?: AraMemoryCard[];
};

export type TeachChatTurn = {
  role: "user" | "ara";
  content: string;
};

export type TeachReply = {
  status: "confused" | "clarify" | "understood" | string;
  message: string;
  follow_up: string;
  lesson_summary?: string;
  memory_saved?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const baseHeaders =
    init.body != null
      ? await authHeaders({ "Content-Type": "application/json" })
      : await authHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...baseHeaders,
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new Error("Please sign in to continue.");
  }
  return res;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const res = await apiFetch("/subjects");
  if (!res.ok) throw new Error(`Failed to load subjects (${res.status})`);
  return res.json();
}

export async function fetchSubject(subjectId: string): Promise<Subject> {
  const res = await apiFetch(`/subjects/${subjectId}`);
  if (!res.ok) throw new Error(`Failed to load subject (${res.status})`);
  return res.json();
}

export async function createSubject(input: {
  name: string;
  unit: string;
  days_until_test?: number | null;
}): Promise<Subject> {
  const res = await apiFetch("/subjects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to save subject (${res.status})`);
  return res.json();
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const res = await apiFetch(`/subjects/${subjectId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete subject (${res.status})`);
}

export async function updateSubject(
  subjectId: string,
  input: {
    days_until_test?: number | null;
    test_date?: string | null;
    unit?: string;
  }
): Promise<Subject> {
  const res = await apiFetch(`/subjects/${subjectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update subject (${res.status})`);
  }
  return res.json();
}

export async function fetchLearningEntries(
  subjectId?: string
): Promise<LearningEntry[]> {
  const path = subjectId
    ? `/learning-entries?subject_id=${subjectId}`
    : "/learning-entries";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load entries (${res.status})`);
  return res.json();
}

export async function createLearningEntry(input: {
  subject_id: string;
  content: string;
}): Promise<LearningEntry> {
  const res = await apiFetch("/learning-entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to save entry (${res.status})`);
  return res.json();
}

export type NotesExplanation = {
  summary: string;
  how_to: string;
  tip: string;
};

/** Ara explains draft notes (before or without saving). */
export async function explainDraftNotes(input: {
  content: string;
  subject?: string;
  unit?: string;
}): Promise<NotesExplanation> {
  const res = await apiFetch("/learning-entries/explain", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to explain notes (${res.status})`);
  return res.json();
}

/** Ara explains a saved learning-log entry. */
export async function explainLearningEntry(
  entryId: string
): Promise<NotesExplanation> {
  const res = await apiFetch(`/learning-entries/${entryId}/explain`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to explain entry (${res.status})`);
  return res.json();
}

export async function fetchQuizForEntry(entryId: string): Promise<Quiz | null> {
  const res = await apiFetch(`/learning-entries/${entryId}/quiz`);
  if (!res.ok) throw new Error(`Failed to load quiz (${res.status})`);
  return res.json();
}

export type QuizDifficulty = "easy" | "medium" | "hard";

export type QuizGenerateOptions = {
  num_questions?: number;
  difficulty?: QuizDifficulty;
};

export async function generateQuiz(
  entryId: string,
  options?: QuizGenerateOptions
): Promise<Quiz> {
  const res = await apiFetch(`/learning-entries/${entryId}/quiz`, {
    method: "POST",
    body: JSON.stringify({
      num_questions: options?.num_questions ?? 8,
      difficulty: options?.difficulty ?? "medium",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail =
      typeof body?.detail === "string" ? body.detail : null;
    if (detail && /quota|429|rate|RESOURCE_EXHAUSTED/i.test(detail)) {
      throw new Error(
        "Gemini hit its free-tier limit for now. Wait a minute (or until tomorrow) and try again, or raise the quota in Google AI Studio."
      );
    }
    throw new Error(detail ?? `Failed to generate quiz (${res.status})`);
  }
  return res.json();
}

export async function submitQuiz(
  quizId: string,
  answers: number[]
): Promise<QuizResult> {
  const res = await apiFetch(`/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(`Failed to submit quiz (${res.status})`);
  return res.json();
}

export async function fetchProgress(): Promise<ProgressStats> {
  const res = await apiFetch("/progress");
  if (!res.ok) throw new Error(`Failed to load progress (${res.status})`);
  return res.json();
}

export async function createPracticeDeck(
  subjectId: string,
  options?: { count?: number; exclude_fronts?: string[] }
): Promise<PracticeDeck> {
  const res = await apiFetch(`/subjects/${subjectId}/practice`, {
    method: "POST",
    body: JSON.stringify({
      count: options?.count ?? 5,
      exclude_fronts: options?.exclude_fronts ?? [],
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.detail ?? `Failed to build practice deck (${res.status})`
    );
  }
  return res.json();
}

export async function fetchShopState(): Promise<ShopState> {
  const res = await apiFetch("/shop/state");
  if (!res.ok) throw new Error(`Failed to load shop (${res.status})`);
  return res.json();
}

export async function purchaseShopItem(itemId: string): Promise<ShopState> {
  const res = await apiFetch("/shop/purchase", {
    method: "POST",
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to buy item (${res.status})`);
  }
  return res.json();
}

export async function equipShopItem(itemId: string): Promise<ShopState> {
  const res = await apiFetch("/shop/equip", {
    method: "POST",
    body: JSON.stringify({ item_id: itemId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to equip item (${res.status})`);
  }
  return res.json();
}

export async function unequipShopSlot(slot: string): Promise<ShopState> {
  const res = await apiFetch("/shop/unequip", {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to unequip item (${res.status})`);
  }
  return res.json();
}

export async function fetchTeachTopics(): Promise<TeachTopic[]> {
  const res = await apiFetch("/teach-ara/topics");
  if (!res.ok) throw new Error(`Failed to load teach topics (${res.status})`);
  const data = await res.json();
  return data.topics ?? [];
}

export async function startTeachAra(input?: {
  topic?: string;
  subject?: string;
  subject_id?: string | null;
}): Promise<TeachStart> {
  const res = await apiFetch("/teach-ara/start", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to start Teach Ara (${res.status})`);
  }
  return res.json();
}

export async function sendTeachAraMessage(input: {
  topic: string;
  subject: string;
  subject_id?: string | null;
  message: string;
  history: TeachChatTurn[];
}): Promise<TeachReply> {
  const res = await apiFetch("/teach-ara/message", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to talk to Ara (${res.status})`);
  }
  return res.json();
}

export type HomeworkChatTurn = { role: "user" | "ara"; content: string };

export type HomeworkHelpReply = {
  message: string;
  follow_up: string;
};

export async function sendHomeworkHelp(input: {
  question?: string;
  history: HomeworkChatTurn[];
  image_base64?: string | null;
  image_mime?: string | null;
}): Promise<HomeworkHelpReply> {
  const res = await apiFetch("/homework/help", {
    method: "POST",
    body: JSON.stringify({
      question: input.question ?? "",
      history: input.history,
      image_base64: input.image_base64 ?? null,
      image_mime: input.image_mime ?? null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Couldn't get homework help (${res.status})`
    );
  }
  return res.json();
}
