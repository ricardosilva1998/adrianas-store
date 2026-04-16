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

type Device = "desktop" | "mobile";

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
  const [device, setDevice] = useState<Device>("desktop");
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const popupRef = useRef<Window | null>(null);
  const previewWrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });

  const api = useMemo<IframeApi>(() => ({
    postMessage: (msg) => iframeRef.current?.contentWindow?.postMessage(msg, "*"),
  }), []);

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
        setToken(data.token);
        tokenRef.current = data.token;
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

  useEffect(() => {
    if (!token) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetch(`/api/admin/pages/${slug}/preview?token=${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      }).then(() => {
        iframeRef.current?.contentWindow?.postMessage({ kind: "page-preview-reload" }, "*");
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.postMessage({ kind: "page-preview-reload" }, "*");
        }
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [title, blocks, token, slug]);

  useEffect(() => {
    if (!previewWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setWrapperSize({ width, height });
    });
    observer.observe(previewWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const DESKTOP_VIRTUAL_WIDTH = 1280;
  const MOBILE_VIRTUAL_WIDTH = 390;
  const virtualWidth = device === "mobile" ? MOBILE_VIRTUAL_WIDTH : DESKTOP_VIRTUAL_WIDTH;
  const scale = wrapperSize.width > 0 ? Math.min(1, (wrapperSize.width - 32) / virtualWidth) : 1;
  const virtualHeight = wrapperSize.height > 0 && scale > 0 ? wrapperSize.height / scale : 720;

  const previewPath = slug === "home" ? "/" : `/${slug}`;
  const iframeSrc = token ? `${previewPath}?preview=${token}` : previewPath;

  const openPopup = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    const win = window.open(
      iframeSrc,
      "adriana-preview",
      "width=1280,height=900,scrollbars=yes,resizable=yes,noopener=no,noreferrer=no",
    );
    if (win) popupRef.current = win;
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-line bg-surface px-6 py-3">
        <div className="flex gap-1 rounded-full border border-ink-line p-1">
          <button type="button" onClick={() => setDevice("desktop")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "desktop" ? "bg-ink text-white" : "text-ink-soft"}`}>Desktop</button>
          <button type="button" onClick={() => setDevice("mobile")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "mobile" ? "bg-ink text-white" : "text-ink-soft"}`}>Mobile</button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openPopup}
            title="Abrir pré-visualização numa nova janela"
            aria-label="Abrir pré-visualização numa nova janela"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-line text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
            </svg>
          </button>
          {hasDraft && (
            <button type="button" onClick={onDiscardDraft} disabled={discarding} className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-red-300 hover:text-red-500 disabled:opacity-40">
              {discarding ? "A descartar…" : "Descartar rascunho"}
            </button>
          )}
          <button type="button" onClick={onPublish} disabled={publishing} className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40">
            {publishing ? "A publicar…" : "Publicar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[460px] shrink-0 overflow-y-auto border-r border-ink-line bg-surface p-6">
          <PreviewIframeContext.Provider value={api}>
            {children}
          </PreviewIframeContext.Provider>
        </aside>
        <div ref={previewWrapperRef} className="flex-1 overflow-hidden bg-ink-line/40 p-4">
          <div
            className="relative overflow-hidden rounded-2xl border border-ink-line bg-white shadow-sm"
            style={{
              width: virtualWidth,
              height: virtualHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <iframe ref={iframeRef} src={iframeSrc} className="h-full w-full border-0" title="Preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
