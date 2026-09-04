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
  applyUiTheme,
  readAraPrefs,
  writeAraPrefs,
  type AraPrefs,
  type UiTheme,
} from "@/lib/araPrefs";

type AraPrefsContextValue = {
  prefs: AraPrefs;
  setMotion: (on: boolean) => void;
  setTips: (on: boolean) => void;
  setStudyReminders: (on: boolean) => void;
  setReminderHour: (hour: number) => void;
  setTheme: (theme: UiTheme) => void;
};

const AraPrefsContext = createContext<AraPrefsContextValue>({
  prefs: DEFAULT_ARA_PREFS,
  setMotion: () => {},
  setTips: () => {},
  setStudyReminders: () => {},
  setReminderHour: () => {},
  setTheme: () => {},
});

export function AraPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AraPrefs>(DEFAULT_ARA_PREFS);

  useEffect(() => {
    const initial = readAraPrefs();
    setPrefs(initial);
    applyUiTheme(initial.theme);
    function onChange(event: Event) {
      const detail = (event as CustomEvent<AraPrefs>).detail;
      const next = detail ?? readAraPrefs();
      setPrefs(next);
      applyUiTheme(next.theme);
    }
    window.addEventListener(ARA_PREFS_EVENT, onChange);
    return () => window.removeEventListener(ARA_PREFS_EVENT, onChange);
  }, []);

  function update(partial: Partial<AraPrefs>) {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    writeAraPrefs(next);
    if (partial.theme) applyUiTheme(partial.theme);
  }

  return (
    <AraPrefsContext.Provider
      value={{
        prefs,
        setMotion: (on) => update({ motion: on }),
        setTips: (on) => update({ tips: on }),
        setStudyReminders: (on) => update({ studyReminders: on }),
        setReminderHour: (hour) => update({ reminderHour: hour }),
        setTheme: (theme) => update({ theme }),
      }}
    >
      {children}
    </AraPrefsContext.Provider>
  );
}

export function useAraPrefs() {
  return useContext(AraPrefsContext);
}
