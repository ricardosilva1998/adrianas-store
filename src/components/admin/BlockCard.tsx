import { useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES } from "../../lib/blocks";
import BlockForm from "./BlockForm";

interface Props {
  slug: string;
  block: Block;
  expanded: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (block: Block) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleExpand: () => void;
}

const blockLabel = (type: BlockType) =>
  BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

export default function BlockCard({
  slug,
  block,
  expanded,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleExpand,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormChange = (data: any) => {
    onChange({ ...block, data: { ...block.data, ...data } });
    setDirty(true);
    setJustSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${slug}/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: block.data }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
        throw new Error(msg ?? "Erro ao guardar");
      }
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-ink-line bg-white">
      <div className="flex cursor-pointer items-center justify-between px-6 py-4" onClick={onToggleExpand}>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-rosa-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rosa-600">
            {blockLabel(block.type)}
          </span>
          <span className="text-xs text-ink-muted">{expanded ? "▼" : "▶"}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↑</button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↓</button>
          <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500">✕</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-line px-6 py-5">
          <BlockForm block={block} onChange={handleFormChange} />
          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs">
              {error && <span className="text-red-600">{error}</span>}
              {justSaved && !error && <span className="text-emerald-600">Guardado!</span>}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-full border border-ink-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500 disabled:opacity-40"
            >
              {saving ? "A guardar…" : "Guardar bloco"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
