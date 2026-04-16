import { useEffect, useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { createBlock } from "../../lib/blocks";
import PagePreviewShell from "./PagePreviewShell";
import BlockCard from "./BlockCard";
import BlockPickerDialog from "./BlockPickerDialog";

interface Props {
  slug: string;
  title: string;
  initialBlocks: Block[];
  published: boolean;
  hasDraft: boolean;
}

export default function PageEditor({ slug, title: initialTitle, initialBlocks, published, hasDraft: initialHasDraft }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [expanded, setExpanded] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);

  useEffect(() => {
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (JSON.stringify(blocks) !== JSON.stringify(initialBlocks)) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocks, initialBlocks]);

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
            onToggleExpand={() => setExpanded(expanded === block.id ? null : block.id)}
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
    </PagePreviewShell>
  );
}
