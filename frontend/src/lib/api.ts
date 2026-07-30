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

export async function fetchQuizForEntry(entryId: string): Promise<Quiz | null> {
  const res = await apiFetch(`/learning-entries/${entryId}/quiz`);
  if (!res.ok) throw new Error(`Failed to load quiz (${res.status})`);
  return res.json();
}

export async function generateQuiz(entryId: string): Promise<Quiz> {
  const res = await apiFetch(`/learning-entries/${entryId}/quiz`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to generate quiz (${res.status})`);
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
  subjectId: string
): Promise<PracticeDeck> {
  const res = await apiFetch(`/subjects/${subjectId}/practice`, {
    method: "POST",
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
