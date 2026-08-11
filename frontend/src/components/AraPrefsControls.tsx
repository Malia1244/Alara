"use client";

import { useAraPrefs } from "@/components/AraPrefsProvider";

type Props = {
  className?: string;
  compact?: boolean;
};

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3"
    >
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand" : "bg-stone-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export default function AraPrefsControls({
  className = "",
  compact = false,
}: Props) {
  const { prefs, setMotion, setTips } = useAraPrefs();

  return (
    <div
      className={`rounded-2xl border border-border bg-white/80 ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      } ${className}`}
    >
      {!compact && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          Ara options
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        <ToggleRow
          id="ara-motion-toggle"
          label="Animations"
          checked={prefs.motion}
          onChange={setMotion}
        />
        <ToggleRow
          id="ara-tips-toggle"
          label="Coach tips"
          checked={prefs.tips}
          onChange={setTips}
        />
      </div>
    </div>
  );
}
