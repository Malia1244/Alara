"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchShopState } from "@/lib/api";
import {
  DEFAULT_LOOK_SRC,
  getActiveLookSrc,
  subscribeLookSrc,
  syncLookFromShop,
} from "@/lib/araOutfitCache";

type AraLookContextValue = {
  lookSrc: string;
  ready: boolean;
};

const AraLookContext = createContext<AraLookContextValue>({
  lookSrc: DEFAULT_LOOK_SRC,
  ready: false,
});

/**
 * One outfit sync for the whole app. AraAvatar must NOT fetch shop itself —
 * that caused races where some pages briefly showed OG then swapped.
 */
export function AraLookProvider({ children }: { children: ReactNode }) {
  const [lookSrc, setLookSrc] = useState(DEFAULT_LOOK_SRC);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setLookSrc(getActiveLookSrc());
    setReady(true);
  }, []);

  useEffect(() => subscribeLookSrc(setLookSrc), []);

  useEffect(() => {
    let cancelled = false;
    fetchShopState()
      .then((data) => {
        if (cancelled) return;
        const src = syncLookFromShop(data);
        setLookSrc(src);
      })
      .catch(() => {
        // Keep memory/cache look if API is asleep.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ lookSrc, ready }),
    [lookSrc, ready]
  );

  return (
    <AraLookContext.Provider value={value}>{children}</AraLookContext.Provider>
  );
}

export function useAraLook(): AraLookContextValue {
  return useContext(AraLookContext);
}
