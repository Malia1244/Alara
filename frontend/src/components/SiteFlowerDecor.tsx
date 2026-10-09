"use client";

import { usePathname } from "next/navigation";
import { CutFlower } from "@/components/CutFlowers";

type Accent = {
  kind: Parameters<typeof CutFlower>[0]["kind"];
  size: number;
  rotate: number;
  className: string;
};

/** Two neat accents per route — never a pile on one page. */
const PAGE_ACCENTS: Record<string, Accent[]> = {
  "/": [
    // Orchid stays only beside the Alara title on Home — use other accents here.
    {
      kind: "lily",
      size: 50,
      rotate: -8,
      className:
        "cut-flower-float absolute right-5 top-24 opacity-90 md:right-12 md:top-20",
    },
    {
      kind: "sprig",
      size: 46,
      rotate: -12,
      className:
        "cut-flower-float-delay absolute bottom-36 left-4 opacity-80 md:left-[17.5rem]",
    },
  ],
  "/calendar": [
    {
      kind: "daisy",
      size: 50,
      rotate: -8,
      className:
        "cut-flower-float absolute right-6 top-24 opacity-90 md:right-12",
    },
    {
      kind: "sprig",
      size: 44,
      rotate: 12,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-80 md:left-[18rem]",
    },
  ],
  "/shop": [
    {
      kind: "lily",
      size: 54,
      rotate: -8,
      className:
        "cut-flower-float absolute right-6 top-28 opacity-90 md:right-14",
    },
    {
      kind: "star",
      size: 38,
      rotate: 12,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-85 md:left-[18rem]",
    },
  ],
  "/lounge": [
    {
      kind: "hibiscusBlue",
      size: 54,
      rotate: -10,
      className:
        "cut-flower-float absolute right-6 top-24 opacity-90 md:right-12",
    },
    {
      kind: "swirlBlue",
      size: 44,
      rotate: 14,
      className:
        "cut-flower-float-delay absolute bottom-44 left-5 opacity-85 md:left-[18rem]",
    },
  ],
  "/progress": [
    {
      kind: "petal",
      size: 52,
      rotate: 8,
      className:
        "cut-flower-float absolute right-6 top-28 opacity-90 md:right-14",
    },
    {
      kind: "daisy",
      size: 46,
      rotate: -12,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-80 md:left-[18rem]",
    },
  ],
  "/ara": [
    {
      kind: "swirlPink",
      size: 52,
      rotate: 16,
      className:
        "cut-flower-float absolute right-6 top-24 opacity-90 md:right-12",
    },
    {
      kind: "hibiscus",
      size: 48,
      rotate: -10,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-85 md:left-[18rem]",
    },
  ],
  "/homework": [
    {
      kind: "lily",
      size: 50,
      rotate: -6,
      className:
        "cut-flower-float absolute right-5 top-24 opacity-90 md:right-12",
    },
    {
      kind: "sprig",
      size: 44,
      rotate: 10,
      className:
        "cut-flower-float-delay absolute bottom-44 left-5 opacity-80 md:left-[18rem]",
    },
  ],
  "/timed-study": [
    {
      kind: "swirlBlue",
      size: 50,
      rotate: -12,
      className:
        "cut-flower-float absolute right-6 top-28 opacity-90 md:right-14",
    },
    {
      kind: "star",
      size: 36,
      rotate: 18,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-85 md:left-[18rem]",
    },
  ],
  "/teach-ara": [
    {
      kind: "hibiscus",
      size: 50,
      rotate: 12,
      className:
        "cut-flower-float absolute right-6 top-24 opacity-90 md:right-12",
    },
    {
      kind: "petal",
      size: 46,
      rotate: -8,
      className:
        "cut-flower-float-delay absolute bottom-40 left-5 opacity-85 md:left-[18rem]",
    },
  ],
};

const SUBJECT_ACCENTS: Accent[] = [
  {
    kind: "daisy",
    size: 48,
    rotate: 10,
    className:
      "cut-flower-float absolute right-5 top-24 opacity-90 md:right-12",
  },
  {
    kind: "sprig",
    size: 42,
    rotate: -14,
    className:
      "cut-flower-float-delay absolute bottom-40 left-5 opacity-80 md:left-[18rem]",
  },
];

const DEFAULT_ACCENTS: Accent[] = [
  {
    kind: "lily",
    size: 48,
    rotate: -8,
    className:
      "cut-flower-float absolute right-6 top-28 opacity-85 md:right-12",
  },
];

function accentsFor(pathname: string): Accent[] {
  if (PAGE_ACCENTS[pathname]) return PAGE_ACCENTS[pathname];
  if (pathname.startsWith("/subjects/")) return SUBJECT_ACCENTS;
  return DEFAULT_ACCENTS;
}

/** Neat per-page flower accents — never a pile. */
export default function SiteFlowerDecor() {
  const pathname = usePathname();
  const accents = accentsFor(pathname);

  return (
    <div className="cut-flower-layer" aria-hidden>
      {accents.map((accent, i) => (
        <CutFlower
          key={`${pathname}-${accent.kind}-${i}`}
          kind={accent.kind}
          size={accent.size}
          rotate={accent.rotate}
          className={accent.className}
        />
      ))}
    </div>
  );
}
