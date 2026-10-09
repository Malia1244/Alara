"use client";

type FlowerKind =
  | "cosmos"
  | "daisy"
  | "sprig"
  | "bud"
  | "lily"
  | "hibiscus"
  | "petal"
  | "swirlPink"
  | "swirlBlue"
  | "star"
  | "hibiscusBlue";

const SRC: Record<FlowerKind, string> = {
  cosmos: "/decor/flower-pink.png",
  daisy: "/decor/flower-daisy.png",
  sprig: "/decor/flower-leaf.png",
  bud: "/decor/flower-pink.png",
  lily: "/decor/flower-lily.png",
  hibiscus: "/decor/flower-hibiscus.png",
  petal: "/decor/flower-petal.png",
  swirlPink: "/decor/flower-swirl-pink.png",
  swirlBlue: "/decor/flower-swirl-blue.png",
  star: "/decor/decor-star.png",
  hibiscusBlue: "/decor/flower-hibiscus-blue.png",
};

type CutFlowerProps = {
  kind: FlowerKind;
  className?: string;
  size?: number;
  rotate?: number;
  priority?: boolean;
};

/** Single cut-flower sticker accent. */
export function CutFlower({
  kind,
  className = "",
  size = 56,
  rotate = 0,
}: CutFlowerProps) {
  return (
    <span
      className={`pointer-events-none inline-flex select-none ${className}`}
      aria-hidden
    >
      <span
        className="inline-flex bg-transparent"
        style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      >
        {/* Native img avoids Next/Image square wrappers that show as white boxes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SRC[kind]}
          alt=""
          draggable={false}
          className="block bg-transparent"
          style={{ width: size, height: "auto" }}
        />
      </span>
    </span>
  );
}

type ScatterProps = {
  /** Soft floating corner accents for auth / empty stages. */
  variant?: "auth" | "page" | "sidebar";
  className?: string;
};

/** Decorative cut-flower scatter — sparse on purpose. */
export default function CutFlowerScatter({
  variant = "page",
  className = "",
}: ScatterProps) {
  if (variant === "auth") {
    return (
      <div className={`cut-flower-layer ${className}`} aria-hidden>
        <CutFlower
          kind="lily"
          size={64}
          rotate={-10}
          className="cut-flower-float absolute left-3 top-12 opacity-90 sm:left-8 sm:top-16"
        />
        <CutFlower
          kind="swirlPink"
          size={56}
          rotate={14}
          className="cut-flower-float-delay absolute right-3 top-20 opacity-90 sm:right-10 sm:top-24"
        />
        <CutFlower
          kind="star"
          size={40}
          rotate={-8}
          className="cut-flower-float absolute bottom-16 right-8 opacity-85 sm:bottom-20 sm:right-14"
        />
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 h-24 overflow-visible ${className}`}
        aria-hidden
      >
        <CutFlower
          kind="star"
          size={34}
          rotate={-10}
          className="cut-flower-float absolute right-2 top-2 opacity-85"
        />
      </div>
    );
  }

  return (
    <div className={`cut-flower-layer ${className}`} aria-hidden>
      <CutFlower
        kind="daisy"
        size={52}
        rotate={12}
        className="cut-flower-float absolute right-4 top-28 opacity-70"
      />
    </div>
  );
}
