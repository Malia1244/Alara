/** Keep in sync with backend/main.py NO_NEW_LEARNING_CONTENT. */
export const NO_NEW_LEARNING_CONTENT =
  "No new material today — reviewing past notes.";

export function isNoNewLearning(content: string | null | undefined): boolean {
  return (content || "").trim() === NO_NEW_LEARNING_CONTENT;
}

export function displayLearningContent(content: string): string {
  if (isNoNewLearning(content)) {
    return "Nothing new today — quiz will review past notes.";
  }
  return content;
}

/** True when an entry has real study text (not a no-new check-in). */
export function hasStudyNotes(content: string | null | undefined): boolean {
  const text = (content || "").trim();
  return Boolean(text) && !isNoNewLearning(text);
}
