"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ARA_PREFS_EVENT,
  DEFAULT_ARA_PREFS,
  readAraPrefs,
  writeAraPrefs,
  type AraPrefs,
} from "@/lib/araPrefs";

type AraPrefsContextValue = {
  prefs: AraPrefs;
  setMotion: (on: boolean) => void;
  setTips: (on: boolean) => void;
  setStudyReminders: (on: boolean) => void;
  setReminderHour: (hour: number) => void;
};

const AraPrefsContext = createContext<AraPrefsContextValue>({
  prefs: DEFAULT_ARA_PREFS,
  setMotion: () => {},
  setTips: () => {},
  setStudyReminders: () => {},
  setReminderHour: () => {},
});

export function AraPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AraPrefs>(DEFAULT_ARA_PREFS);

  useEffect(() => {
    setPrefs(readAraPrefs());
    function onChange(event: Event) {
      const detail = (event as CustomEvent<AraPrefs>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(readAraPrefs());
    }
    window.addEventListener(ARA_PREFS_EVENT, onChange);
    return () => window.removeEventListener(ARA_PREFS_EVENT, onChange);
  }, []);

  function update(partial: Partial<AraPrefs>) {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    writeAraPrefs(next);
  }

  return (
    <AraPrefsContext.Provider
      value={{
        prefs,
        setMotion: (on) => update({ motion: on }),
        setTips: (on) => update({ tips: on }),
        setStudyReminders: (on) => update({ studyReminders: on }),
        setReminderHour: (hour) => update({ reminderHour: hour }),
      }}
    >
      {children}
    </AraPrefsContext.Provider>
  );
}

export function useAraPrefs() {
  return useContext(AraPrefsContext);
}
