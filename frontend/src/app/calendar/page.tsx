"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { CutFlower } from "@/components/CutFlowers";
import {
  apiUnreachableMessage,
  fetchSubjects,
  type Subject,
} from "@/lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseTestDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  useEffect(() => {
    let cancelled = false;
    fetchSubjects()
      .then((data) => {
        if (!cancelled) setSubjects(data);
      })
      .catch(() => {
        if (!cancelled) setError(apiUnreachableMessage());
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const testsByDay = useMemo(() => {
    const map = new Map<string, Subject[]>();
    for (const subject of subjects) {
      if (!subject.test_date) continue;
      const key = subject.test_date;
      const list = map.get(key) ?? [];
      list.push(subject);
      map.set(key, list);
    }
    return map;
  }, [subjects]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startPad = first.getDay();
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0
    ).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const out: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const dayNum = i - startPad + 1;
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), dayNum);
      out.push({
        date,
        inMonth: dayNum >= 1 && dayNum <= daysInMonth,
      });
    }
    return out;
  }, [cursor]);

  const selectedKey = selectedDay
    ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`
    : null;
  const selectedTests = selectedKey ? testsByDay.get(selectedKey) ?? [] : [];

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return subjects
      .filter((s) => s.test_date)
      .map((s) => ({ subject: s, date: parseTestDate(s.test_date!) }))
      .filter(({ date }) => date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
  }, [subjects]);

  const today = new Date();

  return (
    <div className="relative flex flex-1 justify-center overflow-visible px-4 py-10 sm:px-8 sm:py-14">
      <main className="relative z-[1] flex w-full max-w-4xl flex-col gap-6">
        <header className="animate-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <CharacterStage size={72} pose="wave" priority pad="sm" />
            <div className="min-w-0 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Plan
              </p>
              <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Calendar
                <CutFlower kind="daisy" size={34} rotate={-8} />
              </h1>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                See test days from your subjects in one place.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="bloom-pill self-start px-4 py-2 text-sm font-semibold"
          >
            Add subject
          </Link>
        </header>

        {error && <p className="text-sm text-accent">{error}</p>}
        {isLoading && (
          <p className="text-sm text-muted">Loading your calendar…</p>
        )}

        <section className="bloom-card animate-rise-delay p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-panel"
            >
              ←
            </button>
            <p className="font-display text-lg font-semibold text-ink">
              {monthLabel(cursor)}
            </p>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-panel"
            >
              →
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const tests = testsByDay.get(key) ?? [];
              const isToday = sameDay(date, today);
              const isSelected = selectedDay ? sameDay(date, selectedDay) : false;
              return (
                <button
                  key={key + String(inMonth)}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  className={`flex min-h-[3.25rem] flex-col items-center rounded-2xl border px-1 py-1.5 text-sm transition sm:min-h-[4rem] ${
                    isSelected
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : isToday
                        ? "border-brand/40 bg-panel text-ink"
                        : "border-transparent bg-transparent text-ink hover:bg-panel"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span className="font-semibold">{date.getDate()}</span>
                  {tests.length > 0 && (
                    <span className="mt-auto flex gap-0.5 pb-0.5">
                      {tests.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="h-1.5 w-1.5 rounded-full bg-brand"
                          title={t.name}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bloom-card animate-rise p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {selectedDay
              ? selectedDay.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })
              : "Pick a day"}
          </p>
          {selectedTests.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No tests on this day. Add a subject with a test date on Home.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {selectedTests.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/subjects/${s.id}`}
                    className="interactive-tile flex items-center justify-between gap-3 border border-border bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-muted">{s.unit} · test day</p>
                    </div>
                    <span className="text-xs font-semibold text-brand-ink">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Coming up
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {upcoming.map(({ subject, date }) => (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="interactive-tile border border-border bg-surface px-4 py-3"
                >
                  <p className="font-semibold text-ink">{subject.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {subject.days_until_test != null
                      ? ` · ${
                          subject.days_until_test === 0
                            ? "today"
                            : `in ${subject.days_until_test} day${
                                subject.days_until_test === 1 ? "" : "s"
                              }`
                        }`
                      : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
