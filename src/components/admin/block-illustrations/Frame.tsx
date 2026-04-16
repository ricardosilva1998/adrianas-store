import type { ReactNode } from "react";

export default function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" role="img" aria-hidden>
      <rect x="0" y="0" width="200" height="120" fill="var(--color-rosa-50, #fdf2f8)" rx="10" />
      {children}
    </svg>
  );
}
