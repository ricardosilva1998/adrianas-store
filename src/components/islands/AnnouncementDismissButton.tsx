import { useEffect, useState } from "react";

interface Props {
  version: string;
}

export default function AnnouncementDismissButton({ version }: Props) {
  const storageKey = `drisclub-banner-dismissed-${version}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  });

  useEffect(() => {
    if (!dismissed) return;
    const el = document.querySelector(
      `[data-announcement-version="${CSS.escape(version)}"]`,
    );
    if (el instanceof HTMLElement) el.style.display = "none";
  }, [dismissed, version]);

  if (dismissed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        localStorage.setItem(storageKey, "1");
        setDismissed(true);
      }}
      aria-label="Fechar aviso"
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d="M2 2l10 10M12 2L2 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
