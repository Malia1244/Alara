"use client";

import type { CSSProperties, ReactNode } from "react";
import type { StudyVibeId } from "@/lib/studyVibes";

type Props = {
  vibeId: StudyVibeId;
  sceneImage: string;
  className?: string;
  children?: ReactNode;
};

function particleCount(vibeId: StudyVibeId) {
  if (vibeId === "rain") return 28;
  if (vibeId === "beach") return 16;
  if (vibeId === "cafe") return 14;
  return 12;
}

/**
 * YouTube-style study ambience: full scene first, vibe motion, compact HUD.
 * No character overlays — the room/view is the star.
 */
export default function StudyAmbienceStage({
  vibeId,
  sceneImage,
  className = "",
  children,
}: Props) {
  const count = particleCount(vibeId);

  return (
    <div className={`study-ambience ${className}`} data-vibe={vibeId}>
      <div
        className="study-ambience__scene"
        style={{ backgroundImage: `url(${sceneImage})` }}
        aria-hidden
      />

      {/* Soft living light — different wash per vibe */}
      <div className={`study-ambience__wash study-ambience__wash--${vibeId}`} aria-hidden />
      <div className="study-ambience__glow" aria-hidden />

      {/* Secondary living layers */}
      <div className="study-ambience__fx" aria-hidden>
        {vibeId === "beach" && <div className="study-ambience__wave" />}
        {vibeId === "beach" && <div className="study-ambience__wave study-ambience__wave--2" />}
        {vibeId === "rain" && <div className="study-ambience__rain-sheet" />}
        {vibeId === "library" && <div className="study-ambience__godrays" />}
        {vibeId === "focus" && <div className="study-ambience__softpulse" />}
        {vibeId === "cafe" && <div className="study-ambience__lamp-flicker" />}

        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={`study-ambience__particle study-ambience__particle--${vibeId}`}
            style={
              {
                "--i": i,
                "--delay": `${(i * 0.42) % 8}s`,
                "--x": `${4 + ((i * 13) % 92)}%`,
                "--dur": `${4.8 + (i % 6) * 0.9}s`,
                "--drift": `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 6)}px`,
              } as CSSProperties
            }
          />
        ))}

        {(vibeId === "cafe" || vibeId === "focus" || vibeId === "library") &&
          [0, 1, 2, 3].map((i) => (
            <span
              key={`steam-${i}`}
              className={`study-ambience__steam${
                vibeId === "library" ? " study-ambience__steam--dust" : ""
              }`}
              style={
                {
                  "--delay": `${i * 1.15}s`,
                  "--x": `${22 + i * 16}%`,
                  "--bottom": vibeId === "library" ? "48%" : "36%",
                } as CSSProperties
              }
            />
          ))}
      </div>

      {/* Light bottom fade only — keep the scene visible */}
      <div className="study-ambience__floor-fade" aria-hidden />

      <div className="study-ambience__hud">{children}</div>
    </div>
  );
}
