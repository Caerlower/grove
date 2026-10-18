"use client";

import { useMemo } from "react";

/** Falling dust motes + sparse twinkling stars over the landing hero. */
export function HeroParticles({ count = 36 }: { count?: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const left = ((i * 37) % 96) + 2;
        const delay = (i * 0.55) % 16;
        const duration = 11 + (i % 8) * 1.4;
        const size = 2 + (i % 4);
        const isStar = i % 5 === 0;
        const startTop = -4 - (i % 12);
        return { left, delay, duration, size, isStar, startTop, key: i };
      }),
    [count],
  );

  return (
    <div className="hero-particles" aria-hidden>
      {seeds.map((s) => (
        <span
          key={s.key}
          className={s.isStar ? "seed star" : "seed dust"}
          style={{
            left: `${s.left}%`,
            top: `${s.startTop}%`,
            width: s.isStar ? undefined : s.size,
            height: s.isStar ? undefined : s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: s.isStar
              ? `${3.2 + (s.key % 4)}s`
              : `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
