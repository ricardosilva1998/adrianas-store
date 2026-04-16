import { useEffect, useRef, useState } from "react";
import type { SiteConfig } from "../../lib/config";

interface Props {
  initialConfig: SiteConfig;
  currentConfig: SiteConfig;
  isDirty: boolean;
  previewPath: string;            // e.g. "/"
  onSave: () => Promise<void>;
  onReset: () => void;
  children: React.ReactNode;      // the form
  // Optional: called with the iframe window after mount, used for postMessage.
  onIframeReady?: (win: Window) => void;
}

type Device = "desktop" | "mobile";

export default function PreviewShell({
  initialConfig,
  currentConfig,
  isDirty,
  previewPath,
  onSave,
  onReset,
  children,
  onIframeReady,
}: Props) {
  void initialConfig;
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Create a preview token on mount; refresh it on every config change (debounced).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/site-config/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig),
      });
      if (!res.ok) return;
      const data = await res.json() as { token: string };
      if (!cancelled) setToken(data.token);
    })();
    return () => {
      cancelled = true;
      if (token) {
        fetch(`/api/admin/site-config/preview?token=${token}`, { method: "DELETE" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced PUT on every config change.
  useEffect(() => {
    if (!token) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/admin/site-config/preview?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig),
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [currentConfig, token]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao gravar");
    } finally {
      setSaving(false);
    }
  };

  const iframeSrc = token ? `${previewPath}?preview=${token}` : previewPath;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-line bg-white px-6 py-3">
        <div className="flex gap-1 rounded-full border border-ink-line p-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`px-3 py-1 text-xs font-medium rounded-full ${device === "desktop" ? "bg-ink text-white" : "text-ink-soft"}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`px-3 py-1 text-xs font-medium rounded-full ${device === "mobile" ? "bg-ink text-white" : "text-ink-soft"}`}
          >
            Mobile
          </button>
        </div>

        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          <button
            type="button"
            onClick={onReset}
            disabled={!isDirty || saving}
            className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft disabled:opacity-40"
          >
            Reverter
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
          >
            {saving ? "A gravar…" : "Gravar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[420px] shrink-0 overflow-y-auto border-r border-ink-line bg-white p-6">
          {children}
        </aside>
        <div className="flex-1 overflow-hidden bg-ink-line/40 p-4">
          <div
            className="mx-auto h-full overflow-hidden rounded-2xl border border-ink-line bg-white shadow-sm"
            style={{ maxWidth: device === "mobile" ? 390 : "100%" }}
          >
            <iframe
              ref={(el) => {
                iframeRef.current = el;
                if (el && onIframeReady && el.contentWindow) {
                  onIframeReady(el.contentWindow);
                }
              }}
              src={iframeSrc}
              className="h-full w-full"
              title="Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
