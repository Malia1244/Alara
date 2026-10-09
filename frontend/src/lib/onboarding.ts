/** First-run tutorial after account creation. */

export const TUTORIAL_PENDING_KEY = "alara-tutorial-pending";
export const TUTORIAL_DONE_PREFIX = "alara-tutorial-done:";
export const SPLASH_SKIP_KEY = "alara-skip-welcome-splash";

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

/** Short how-to: subjects → notes → quiz → why it helps. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Hi — I’m Ara",
    body: "Alara helps you remember what you study. Add a class, log what you learned, then quiz it so it sticks.",
  },
  {
    id: "subjects",
    title: "1. Add a subject",
    body: "On Home, add a class (like Biology), the unit you’re in, and days until the test. That shows up on your calendar.",
    href: "/",
    cta: "Open Home",
  },
  {
    id: "notes",
    title: "2. Log what you learned",
    body: "Open the subject and paste your notes or what you studied today. Short is fine — just get it in.",
  },
  {
    id: "quiz",
    title: "3. Take a quiz",
    body: "Quiz yourself on those notes. You earn points, review weak spots, and stay ready for the test.",
  },
  {
    id: "done",
    title: "That’s it",
    body: "Subjects keep you organized. Notes capture learning. Quizzes lock it in. Check Calendar for upcoming tests.",
    href: "/calendar",
    cta: "See Calendar",
  },
];

export function markTutorialPending() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TUTORIAL_PENDING_KEY, "1");
  } catch {
    // ignore
  }
}

export function clearTutorialPending() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TUTORIAL_PENDING_KEY);
  } catch {
    // ignore
  }
}

export function isTutorialPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TUTORIAL_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function isTutorialDone(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${TUTORIAL_DONE_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TUTORIAL_DONE_PREFIX}${userId}`, "1");
    window.localStorage.removeItem(TUTORIAL_PENDING_KEY);
  } catch {
    // ignore
  }
}

/** Show tutorial for brand-new accounts (pending flag) that haven’t finished it. */
export function shouldShowTutorial(userId: string | undefined | null): boolean {
  if (!userId) return false;
  if (isTutorialDone(userId)) return false;
  return isTutorialPending();
}

export function isWelcomeSplashSkipped(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SPLASH_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function skipWelcomeSplashPermanently() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPLASH_SKIP_KEY, "1");
  } catch {
    // ignore
  }
}
