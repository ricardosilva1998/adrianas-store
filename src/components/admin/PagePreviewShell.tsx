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
      });
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [title, blocks, token, slug]);

  const previewPath = slug === "home" ? "/" : `/${slug}`;
  const iframeSrc = token ? `${previewPath}?preview=${token}` : previewPath;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-line bg-surface px-6 py-3">
        <div className="flex gap-1 rounded-full border border-ink-line p-1">
          <button type="button" onClick={() => setDevice("desktop")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "desktop" ? "bg-ink text-white" : "text-ink-soft"}`}>Desktop</button>
          <button type="button" onClick={() => setDevice("mobile")} className={`px-3 py-1 text-xs font-medium rounded-full ${device === "mobile" ? "bg-ink text-white" : "text-ink-soft"}`}>Mobile</button>
        </div>
        <div className="flex items-center gap-3">
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
        <div className="flex-1 overflow-hidden bg-ink-line/40 p-4">
          <div className="mx-auto h-full overflow-hidden rounded-2xl border border-ink-line bg-white shadow-sm" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <iframe ref={iframeRef} src={iframeSrc} className="h-full w-full" title="Preview" />
          </div>
        </div>
      </div>
    </div>
  );
}
