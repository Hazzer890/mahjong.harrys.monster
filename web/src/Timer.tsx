import type { CSSProperties } from 'react';

// Visual only: the ring drains in CSS and pulses when it hits zero. Nothing here
// discards, passes or nudges the server — the clock is a courtesy, not a referee.
// Restart by remounting: <Timer key={`${turn}-${phase}`} />.
export default function Timer({ seconds = 20 }: { seconds?: number }) {
  const r = 9;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      className="timer"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      style={{ '--timer-duration': `${seconds}s` } as CSSProperties}
    >
      <circle className="timer-track" cx="12" cy="12" r={r} />
      <circle
        className="timer-arc"
        cx="12"
        cy="12"
        r={r}
        style={{ strokeDasharray: circumference, ['--timer-length' as string]: circumference }}
      />
    </svg>
  );
}
