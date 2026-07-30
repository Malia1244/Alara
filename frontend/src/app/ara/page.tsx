import AraAvatar from "@/components/AraAvatar";
import Link from "next/link";

export default function AraPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
      <main className="flex w-full max-w-3xl flex-col items-center gap-5 text-center">
        <div className="animate-rise">
          <AraAvatar size={168} pose="wink" priority />
        </div>
        <div className="animate-rise-delay">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            Your buddy
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Hi, I&apos;m Ara
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            I help quiz you, cheer on your streaks, and wear whatever you pick
            up in the shop.
          </p>
        </div>
        <Link
          href="/shop"
          className="rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          Dress me up
        </Link>
        <div className="mt-2 w-full rounded-[1.75rem] border border-dashed border-border bg-surface/70 px-6 py-8">
          <p className="font-display text-base font-bold text-stone-800">
            More of me coming soon
          </p>
          <p className="mt-1 text-xs text-muted">
            Chatting and encouragement are on the way.
          </p>
        </div>
      </main>
    </div>
  );
}
