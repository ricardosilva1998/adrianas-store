import { useCallback, useContext, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { createBlock } from "../../lib/blocks";
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
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
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
          const block = { id: crypto.randomUUID().slice(0, 10), type: preset.type, data: preset.data } as any;
          setBlocks((prev) => [...prev, block]);
          setExpanded(block.id);
          await fetch(`/api/admin/pages/${slug}/blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ block }),
          });
          setHasDraft(true);
          setShowPicker(false);
        }}
      />
    </div>
  );
}

export default function PageEditor({ slug, title: initialTitle, initialBlocks, published, hasDraft: initialHasDraft }: Props) {
  const [title, setTitle] = useState(initialTitle);
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

  useEffect(() => {
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (dirtyBlockIds.size > 0) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyBlockIds]);

  const upsertBlock = (updated: Block) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const moveBlock = async (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const next = blocks.slice();
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setBlocks(next);
    await fetch(`/api/admin/pages/${slug}/blocks/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    });
    setHasDraft(true);
  };

  const removeBlock = async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/admin/pages/${slug}/blocks/${id}`, { method: "DELETE" });
    setHasDraft(true);
  };

  const addBlock = async (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpanded(block.id);
    setShowPicker(false);
    await fetch(`/api/admin/pages/${slug}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block }),
    });
    setHasDraft(true);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`/api/admin/pages/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks, published, saveAsDraft: false }),
      });
      setHasDraft(false);
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!confirm("Descartar as alterações não publicadas?")) return;
    setDiscarding(true);
    try {
      await fetch(`/api/admin/pages/${slug}/discard-draft`, { method: "POST" });
      window.location.reload();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <PagePreviewShell
      slug={slug}
      title={title}
      blocks={blocks}
      publishing={publishing}
      discarding={discarding}
      hasDraft={hasDraft}
      onPublish={handlePublish}
      onDiscardDraft={handleDiscardDraft}
    >
      <PageEditorContent
        slug={slug}
        title={title}
        setTitle={setTitle}
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
