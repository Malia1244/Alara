"use client";

type Props = {
  message: string | null;
  onClose: () => void;
};

/** Dismissible notice fixed near the top of the viewport. */
export default function NoticeBanner({ message, onClose }: Props) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-4 md:top-5">
      <div
        role="status"
        className="pointer-events-auto animate-rise flex w-full max-w-lg items-start gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-[0_16px_40px_-20px_rgba(28,25,23,0.45)]"
      >
        <p className="flex-1 text-sm font-semibold leading-snug text-stone-800">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-xl px-2 py-0.5 text-lg leading-none text-muted transition-colors hover:bg-stone-100 hover:text-stone-800"
        >
          ×
        </button>
      </div>
    </div>
  );
}
