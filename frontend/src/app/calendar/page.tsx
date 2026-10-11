"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import CharacterStage from "@/components/CharacterStage";
import { CutFlower } from "@/components/CutFlowers";
import {
  apiUnreachableMessage,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchSubjects,
  type CalendarEvent,
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

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function daysAwayLabel(days: number | null) {
  if (days == null) return null;
  if (days === 0) return "today";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

type UpcomingItem =
  | { kind: "test"; id: string; title: string; date: Date; href: string; meta: string }
  | { kind: "event"; id: string; title: string; date: Date; href?: string; meta: string };

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [eventDate, setEventDate] = useState(() => toIsoDate(new Date()));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const subjectData = await fetchSubjects();
        if (cancelled) return;
        setSubjects(subjectData);
      } catch {
        if (!cancelled) setError(apiUnreachableMessage());
      }

      try {
        const eventData = await fetchCalendarEvents();
        if (cancelled) return;
        setEvents(eventData);
      } catch (err) {
        if (cancelled) return;
        // Keep tests visible even if the events table isn't migrated yet.
        setFormError(
          err instanceof Error ? err.message : "Couldn't load events."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedDay) setEventDate(toIsoDate(selectedDay));
  }, [selectedDay]);

  const testsByDay = useMemo(() => {
    const map = new Map<string, Subject[]>();
    for (const subject of subjects) {
      if (!subject.test_date) continue;
      const list = map.get(subject.test_date) ?? [];
      list.push(subject);
      map.set(subject.test_date, list);
    }
    return map;
  }, [subjects]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.event_date) ?? [];
      list.push(event);
      map.set(event.event_date, list);
    }
    return map;
  }, [events]);

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

  const selectedKey = selectedDay ? toIsoDate(selectedDay) : null;
  const selectedTests = selectedKey ? testsByDay.get(selectedKey) ?? [] : [];
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];
  const dayEmpty = selectedTests.length === 0 && selectedEvents.length === 0;

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: UpcomingItem[] = [];

    for (const subject of subjects) {
      if (!subject.test_date) continue;
      const date = parseIsoDate(subject.test_date);
      if (date < today) continue;
      items.push({
        kind: "test",
        id: `test-${subject.id}`,
        title: subject.name,
        date,
        href: `/subjects/${subject.id}`,
        meta: [
          "Test",
          subject.unit,
          daysAwayLabel(subject.days_until_test),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    for (const event of events) {
      const date = parseIsoDate(event.event_date);
      if (date < today) continue;
      items.push({
        kind: "event",
        id: `event-${event.id}`,
        title: event.title,
        date,
        href: event.subject_id ? `/subjects/${event.subject_id}` : undefined,
        meta: [
          "Event",
          event.subject_name,
          date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [subjects, events]);

  const today = new Date();

  async function onAddEvent(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError("Give it a short title.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createCalendarEvent({
        title: trimmed,
        event_date: eventDate,
        notes: notes.trim(),
        subject_id: subjectId || null,
      });
      setEvents((prev) =>
        [...prev, created].sort((a, b) =>
          a.event_date.localeCompare(b.event_date)
        )
      );
      setTitle("");
      setNotes("");
      setSubjectId("");
      setShowAdd(false);
      setSelectedDay(parseIsoDate(created.event_date));
      setCursor(startOfMonth(parseIsoDate(created.event_date)));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Couldn't save that event."
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteEvent(id: string) {
    setDeletingId(id);
    setFormError(null);
    try {
      await deleteCalendarEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Couldn't remove that event."
      );
    } finally {
      setDeletingId(null);
    }
  }

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
                Tests from your subjects, plus anything else you add.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="bloom-pill px-4 py-2 text-sm font-semibold"
            >
              {showAdd ? "Close" : "Add event"}
            </button>
            <Link
              href="/"
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panel"
            >
              Add subject
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Test
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink/45" />
            Event
          </span>
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}
        {isLoading && (
          <p className="text-sm text-muted">Loading your calendar…</p>
        )}

        {showAdd && (
          <form
            onSubmit={onAddEvent}
            className="bloom-card animate-rise flex flex-col gap-3 p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              New event
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Study group, review night…"
                maxLength={120}
                className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-ink outline-none transition focus:border-brand"
                required
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Date</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-ink outline-none transition focus:border-brand"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Subject (optional)</span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-ink outline-none transition focus:border-brand"
                >
                  <option value="">None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What to bring, where, etc."
                maxLength={500}
                rows={2}
                className="resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-ink outline-none transition focus:border-brand"
              />
            </label>
            {formError && <p className="text-sm text-accent">{formError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="bloom-pill self-start px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save event"}
            </button>
          </form>
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
              const key = toIsoDate(date);
              const dayTests = testsByDay.get(key) ?? [];
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = sameDay(date, today);
              const isSelected = selectedDay
                ? sameDay(date, selectedDay)
                : false;
              const dots = [
                ...dayTests.slice(0, 2).map((t) => ({
                  id: `t-${t.id}`,
                  className: "bg-brand",
                  title: `Test: ${t.name}`,
                })),
                ...dayEvents.slice(0, 2).map((ev) => ({
                  id: `e-${ev.id}`,
                  className: "bg-ink/45",
                  title: ev.title,
                })),
              ].slice(0, 3);

              return (
                <button
                  key={key + String(inMonth)}
                  type="button"
                  onClick={() => {
                    setSelectedDay(date);
                    setShowAdd(false);
                  }}
                  className={`flex min-h-[3.25rem] flex-col items-center rounded-2xl border px-1 py-1.5 text-sm transition sm:min-h-[4rem] ${
                    isSelected
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : isToday
                        ? "border-brand/40 bg-panel text-ink"
                        : "border-transparent bg-transparent text-ink hover:bg-panel"
                  } ${inMonth ? "" : "opacity-35"}`}
                >
                  <span className="font-semibold">{date.getDate()}</span>
                  {dots.length > 0 && (
                    <span className="mt-auto flex gap-0.5 pb-0.5">
                      {dots.map((dot) => (
                        <span
                          key={dot.id}
                          className={`h-1.5 w-1.5 rounded-full ${dot.className}`}
                          title={dot.title}
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {selectedDay
                ? selectedDay.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "Pick a day"}
            </p>
            {selectedDay && (
              <button
                type="button"
                onClick={() => {
                  setEventDate(toIsoDate(selectedDay));
                  setShowAdd(true);
                }}
                className="text-xs font-semibold text-brand-ink transition hover:underline"
              >
                + Event this day
              </button>
            )}
          </div>

          {dayEmpty ? (
            <p className="mt-2 text-sm text-muted">
              Nothing here yet. Add an event, or set a test date when you create
              a subject on Home.
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
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                        Test
                      </p>
                      <p className="font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.unit}
                        {daysAwayLabel(s.days_until_test)
                          ? ` · ${daysAwayLabel(s.days_until_test)}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-brand-ink">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
              {selectedEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="interactive-tile flex items-start justify-between gap-3 border border-border bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      Event
                    </p>
                    <p className="font-semibold text-ink">{ev.title}</p>
                    {(ev.subject_name || ev.notes) && (
                      <p className="mt-0.5 text-xs text-muted">
                        {[ev.subject_name, ev.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {ev.subject_id && (
                      <Link
                        href={`/subjects/${ev.subject_id}`}
                        className="mt-1 inline-block text-xs font-semibold text-brand-ink hover:underline"
                      >
                        Open subject →
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(ev.id)}
                    disabled={deletingId === ev.id}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:bg-panel hover:text-ink disabled:opacity-50"
                  >
                    {deletingId === ev.id ? "…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {formError && !showAdd && (
            <p className="mt-2 text-sm text-accent">{formError}</p>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Coming up
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {upcoming.map((item) => {
                const inner = (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                      {item.kind === "test" ? "Test" : "Event"}
                    </p>
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.meta}</p>
                  </>
                );
                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="interactive-tile border border-border bg-surface px-4 py-3"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={item.id}
                    className="border border-border bg-surface px-4 py-3"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
