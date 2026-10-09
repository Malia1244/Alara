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

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Alara",
    body: "I’m Ara. I’ll help you keep notes, quiz what you actually studied, and stay on track for tests.",
  },
  {
    id: "subjects",
    title: "Add a subject",
    body: "Start on Home — name a class, the unit you’re in, and optionally how many days until the test.",
    href: "/",
    cta: "Go to Home",
  },
  {
    id: "notes-quiz",
    title: "Notes → quiz",
    body: "Open a subject, paste what you learned, then take a quiz on that material. Points unlock looks in the Shop.",
  },
  {
    id: "shop",
    title: "Dress Ara",
    body: "Earn points from quizzes and pick outfits in the Shop. Your look stays with you everywhere in Alara.",
    href: "/shop",
    cta: "Peek at Shop",
  },
  {
    id: "done",
    title: "You’re set",
    body: "Try Timed Study when you want a focus block, or Lounge to share homework with other students. You’ve got this.",
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
