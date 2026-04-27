import { useEffect, useState } from "react";

type Props = {
  title: string;
  subtitle: string;
  couponCode: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  delaySeconds: number;
  dismissDays: number;
};

const storageKey = (code: string) => `drisclub-popup-dismissed-${code || "default"}`;

export default function CouponPopup({
  title,
  subtitle,
  couponCode,
  buttonText,
  buttonUrl,
  imageUrl,
  delaySeconds,
  dismissDays,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey(couponCode));
      if (raw) {
        const dismissedAt = Number(raw);
        if (Number.isFinite(dismissedAt)) {
          const ageMs = Date.now() - dismissedAt;
          const ttlMs = dismissDays * 24 * 60 * 60 * 1000;
          if (ageMs < ttlMs) return;
        }
      }
    } catch {
      // localStorage may be unavailable; show anyway
    }

    const id = window.setTimeout(() => setOpen(true), delaySeconds * 1000);
    return () => window.clearTimeout(id);
  }, [couponCode, delaySeconds, dismissDays]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey(couponCode), String(Date.now()));
    } catch {
      // ignore
    }
  };

  const copyCode = async () => {
    if (!couponCode) return;
    try {
      await navigator.clipboard.writeText(couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coupon-popup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow ring-1 ring-ink-line transition hover:bg-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        {imageUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-rosa-100">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" aria-hidden />
          </div>
        )}

        <div className="px-7 py-7 text-center">
          {title && (
            <h2 id="coupon-popup-title" className="text-2xl font-semibold text-ink">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
          )}

          {couponCode && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rosa-300 bg-rosa-50 px-4 py-3">
              <span className="font-mono text-lg font-semibold tracking-wider text-rosa-700">
                {couponCode}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="text-xs font-medium text-rosa-700 underline hover:text-rosa-500"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          )}

          {buttonText && buttonUrl && (
            <a
              href={buttonUrl}
              onClick={dismiss}
              className="btn-primary mt-6 inline-flex w-full justify-center"
            >
              {buttonText}
            </a>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-3 text-xs text-ink-muted hover:text-rosa-500"
          >
            Não obrigado
          </button>
        </div>
      </div>
    </div>
  );
}
