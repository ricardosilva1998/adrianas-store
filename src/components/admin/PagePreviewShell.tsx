import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Block } from "../../lib/blocks";

type IframeApi = { postMessage: (msg: unknown) => void };
export const PreviewIframeContext = createContext<IframeApi | null>(null);

interface Props {
  slug: string;
  title: string;
  blocks: Block[];
  publishing?: boolean;
  discarding?: boolean;
  hasDraft?: boolean;
  children: ReactNode;
  onPublish: () => Promise<void>;
  onDiscardDraft: () => Promise<void>;
}

export default function PagePreviewShell({
  slug,
  title,
  blocks,
  publishing = false,
  discarding = false,
  hasDraft = false,
  children,
  onPublish,
  onDiscardDraft,
}: Props) {
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  // Create preview token on mount. Clean up on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/pages/${slug}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { token: string };
      if (!cancelled) {
        tokenRef.current = data.token;
        setToken(data.token);
      }
    })();
    return () => {
      cancelled = true;
      if (tokenRef.current) {
        fetch(`/api/admin/pages/${slug}/preview?token=${tokenRef.current}`, { method: "DELETE" });
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced PUT on prop changes. Notify popup if open.
  useEffect(() => {
    if (!token) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/admin/pages/${slug}/preview?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      }).then(() => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.postMessage({ kind: "page-preview-reload" }, "*");
        }
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [title, blocks, token, slug]);

  // Poll popup.closed every 1s so the button label updates when user closes the popup.
  useEffect(() => {
    if (!popupOpen) return;
    const id = window.setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        popupRef.current = null;
        setPopupOpen(false);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [popupOpen]);

  const previewPath = slug === "home" ? "/" : `/${slug}`;
  const previewUrl = token ? `${previewPath}?preview=${token}` : previewPath;

  const openPopup = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    const win = window.open(
      previewUrl,
      "adriana-preview",
      "width=1280,height=900,scrollbars=yes,resizable=yes",
    );
    if (win) {
      popupRef.current = win;
      setPopupOpen(true);
    }
  };

  const closePopup = () => {
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    popupRef.current = null;
    setPopupOpen(false);
  };

  // Iframe API for child components (scroll-to-block, etc.) now targets the popup.
  const api = useMemo<IframeApi>(
    () => ({
      postMessage: (msg) => {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.postMessage(msg, "*");
        }
      },
    }),
    [],
  );

  return (
    <PreviewIframeContext.Provider value={api}>
      <div className="flex min-h-[calc(100vh-80px)] flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-line bg-surface px-6 py-3">
          <button
            type="button"
            onClick={popupOpen ? closePopup : openPopup}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${
              popupOpen
                ? "border border-rosa-400 bg-rosa-50 text-rosa-700 hover:border-rosa-500 dark:bg-rosa-500/15 dark:text-rosa-200"
                : "bg-ink text-white hover:bg-ink/90"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
            </svg>
            {popupOpen ? "Fechar pré-visualização" : "Abrir pré-visualização"}
          </button>

          <div className="flex items-center gap-3">
            {hasDraft && (
              <button
                type="button"
                onClick={onDiscardDraft}
                disabled={discarding}
                className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-red-300 hover:text-red-500 disabled:opacity-40"
              >
                {discarding ? "A descartar…" : "Descartar rascunho"}
              </button>
            )}
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing}
              className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
            >
              {publishing ? "A publicar…" : "Publicar"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-muted">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {children}
          </div>
        </div>
      </div>
    </PreviewIframeContext.Provider>
  );
}
