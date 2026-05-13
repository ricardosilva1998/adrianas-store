import { useCallback, useContext, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { createBlock, instantiatePreset } from "../../lib/blocks";
import PagePreviewShell, { PreviewIframeContext } from "./PagePreviewShell";
import BlockCard from "./BlockCard";
import BlockPickerDialog from "./BlockPickerDialog";

interface Props {
  slug: string;
  title: string;
  initialBlocks: Block[];
  published: boolean;
  hasDraft: boolean;
}

interface ContentProps {
  slug: string;
  title: string;
  setTitle: (t: string) => void;
  onTitleBlur: () => void;
  blocks: Block[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  upsertBlock: (b: Block) => void;
  moveBlock: (id: string, dir: "up" | "down") => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
  addBlock: (type: BlockType) => Promise<void>;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setHasDraft: (v: boolean) => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
}

function PageEditorContent({
  slug,
  title,
  setTitle,
  onTitleBlur,
  blocks,
  expanded,
  setExpanded,
  showPicker,
  setShowPicker,
  upsertBlock,
  moveBlock,
  removeBlock,
  addBlock,
  setBlocks,
  setHasDraft,
  onDirtyChange,
}: ContentProps) {
  const iframeApi = useContext(PreviewIframeContext);

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl border border-ink-line bg-surface p-6">
        <label className="field-label" htmlFor="title">Título</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={onTitleBlur} className="field-input" />
      </div>

      {blocks.map((block, idx) => (
        <BlockCard
          key={block.id}
          slug={slug}
          block={block}
          expanded={expanded === block.id}
          canMoveUp={idx > 0}
          canMoveDown={idx < blocks.length - 1}
          onChange={upsertBlock}
          onMoveUp={() => moveBlock(block.id, "up")}
          onMoveDown={() => moveBlock(block.id, "down")}
          onRemove={() => removeBlock(block.id)}
          onToggleExpand={() => {
            const nextId = expanded === block.id ? null : block.id;
            setExpanded(nextId);
            if (nextId) iframeApi?.postMessage({ kind: "scroll-to-block", id: nextId });
          }}
          onDirtyChange={onDirtyChange}
        />
      ))}

      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar bloco
      </button>
      <BlockPickerDialog
        open={showPicker}
        context="page"
        onClose={() => setShowPicker(false)}
        onInsertBlockType={async (type) => {
          await addBlock(type);
          setShowPicker(false);
        }}
        onInsertPreset={async (preset) => {
          const block = instantiatePreset(preset);
          setBlocks((prev) => [...prev, block]);
          setExpanded(block.id);
          try {
            const res = await fetch(`/api/admin/pages/${slug}/blocks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ block }),
            });
            if (!res.ok) throw new Error(`Erro ${res.status}`);
            setHasDraft(true);
          } catch {
            setBlocks((cur) => cur.filter((b) => b.id !== block.id));
            alert("Erro ao inserir preset. Tenta novamente.");
          }
          setShowPicker(false);
        }}
      />
    </div>
  );
}

export default function PageEditor({ slug, title: initialTitle, initialBlocks, published, hasDraft: initialHasDraft }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [expanded, setExpanded] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [dirtyBlockIds, setDirtyBlockIds] = useState<Set<string>>(new Set());

  const handleDirtyChange = useCallback((id: string, dirty: boolean) => {
    setDirtyBlockIds((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const saveTitle = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === savedTitle) return;
    const prev = savedTitle;
    setSavedTitle(trimmed);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
    } catch {
      setSavedTitle(prev);
      alert("Erro ao guardar título.");
    }
  }, [title, savedTitle, slug]);

  useEffect(() => {
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (dirtyBlockIds.size > 0 || title.trim() !== savedTitle) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyBlockIds, title, savedTitle]);

  const upsertBlock = (updated: Block) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const moveBlock = async (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const prev = blocks;
    const next = blocks.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setBlocks(next);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/blocks/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((b) => b.id) }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setHasDraft(true);
    } catch {
      setBlocks(prev);
      alert("Erro ao mover bloco. Tenta novamente.");
    }
  };

  const removeBlock = async (id: string) => {
    const prev = blocks;
    const prevDirty = dirtyBlockIds.has(id);
    setBlocks((cur) => cur.filter((b) => b.id !== id));
    // Removed blocks can never become un-dirty themselves, so clear their id
    // from the dirty set right away — otherwise Publicar stays blocked forever.
    if (prevDirty) handleDirtyChange(id, false);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/blocks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setHasDraft(true);
    } catch {
      setBlocks(prev);
      if (prevDirty) handleDirtyChange(id, true);
      alert("Erro ao remover bloco. Tenta novamente.");
    }
  };

  const addBlock = async (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpanded(block.id);
    setShowPicker(false);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setHasDraft(true);
    } catch {
      setBlocks((cur) => cur.filter((b) => b.id !== block.id));
      alert("Erro ao adicionar bloco. Tenta novamente.");
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Auto-flush any pending block edits so the user does not have to click
      // "Guardar bloco" on each card before Publicar. We patch from `blocks`
      // (the live source of truth fed by upsertBlock) rather than touching
      // BlockCard internals.
      const pendingIds = Array.from(dirtyBlockIds).filter((id) =>
        blocks.some((b) => b.id === id),
      );
      for (const id of pendingIds) {
        const block = blocks.find((b) => b.id === id);
        if (!block) continue;
        const res = await fetch(`/api/admin/pages/${slug}/blocks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: block.data }),
        });
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
          throw new Error(`Não foi possível guardar um bloco: ${msg ?? res.status}`);
        }
        handleDirtyChange(id, false);
      }

      // Same for an unsaved title.
      const trimmedTitle = title.trim();
      if (trimmedTitle && trimmedTitle !== savedTitle) {
        const res = await fetch(`/api/admin/pages/${slug}/title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle }),
        });
        if (!res.ok) throw new Error(`Não foi possível guardar o título (Erro ${res.status})`);
        setSavedTitle(trimmedTitle);
      }

      const res = await fetch(`/api/admin/pages/${slug}/publish`, { method: "POST" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao publicar. Tenta novamente.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!confirm("Descartar as alterações não publicadas?")) return;
    setDiscarding(true);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/discard-draft`, { method: "POST" });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      window.location.reload();
    } catch {
      alert("Erro ao descartar rascunho. Tenta novamente.");
    } finally {
      setDiscarding(false);
    }
  };

  const titleDirty = title.trim() !== savedTitle;
  // Publish auto-flushes pending block edits and unsaved title, so the button
  // no longer needs to be gated by `dirtyBlockIds.size > 0 || titleDirty`.
  const publishBlocked = false;

  return (
    <PagePreviewShell
      slug={slug}
      title={title}
      blocks={blocks}
      publishing={publishing}
      discarding={discarding}
      hasDraft={hasDraft}
      publishBlocked={publishBlocked}
      onPublish={handlePublish}
      onDiscardDraft={handleDiscardDraft}
    >
      <PageEditorContent
        slug={slug}
        title={title}
        setTitle={setTitle}
        onTitleBlur={saveTitle}
        blocks={blocks}
        expanded={expanded}
        setExpanded={setExpanded}
        showPicker={showPicker}
        setShowPicker={setShowPicker}
        upsertBlock={upsertBlock}
        moveBlock={moveBlock}
        removeBlock={removeBlock}
        addBlock={addBlock}
        setBlocks={setBlocks}
        setHasDraft={setHasDraft}
        onDirtyChange={handleDirtyChange}
      />
    </PagePreviewShell>
  );
}
