import { useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES, createBlock } from "../../lib/blocks";
import BlockPickerDialog from "./BlockPickerDialog";

interface Props {
  name: string;
  label: string;
  page: string;
  blocks: Block[];
}

const blockLabel = (type: BlockType) =>
  BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

export default function SlotEditor({ name, label, page, blocks: initialBlocks }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [showPicker, setShowPicker] = useState(false);

  const updateBlock = (id: string, data: any) =>
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    );
  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const moveBlock = (id: string, dir: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };
  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks((prev) => [...prev, block]);
    setExpandedBlock(block.id);
    setShowPicker(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/slots/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro ${res.status}`);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-ink-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-rosa-500">
          {page}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-ink">{label}</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Identificador: <code className="rounded bg-rosa-50 px-1">{name}</code>
        </p>
      </div>

      <div className="grid gap-4">
        {blocks.map((block, idx) => (
          <div key={block.id} className="rounded-3xl border border-ink-line bg-surface">
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() =>
                setExpandedBlock(expandedBlock === block.id ? null : block.id)
              }
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-rosa-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rosa-600">
                  {blockLabel(block.type)}
                </span>
                <span className="text-xs text-ink-muted">
                  {expandedBlock === block.id ? "▼" : "▶"}
                </span>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "up")}
                  disabled={idx === 0}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                >↑</button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={idx === blocks.length - 1}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                >↓</button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500"
                >✕</button>
              </div>
            </div>
            {expandedBlock === block.id && (
              <div className="border-t border-ink-line px-6 py-5">
                <p className="mb-2 text-xs text-ink-muted">
                  Tipo: <strong>{block.type}</strong>. Edita os campos JSON abaixo (cuidado com a sintaxe).
                </p>
                <textarea
                  value={JSON.stringify(block.data, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateBlock(block.id, parsed);
                    } catch { /* ignore */ }
                  }}
                  rows={10}
                  className="w-full resize-y rounded-xl border border-ink-line bg-surface p-4 font-mono text-xs leading-relaxed"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <BlockPickerDialog
        open={showPicker}
        context="page"
        onClose={() => setShowPicker(false)}
        onInsertBlockType={(type) => { addBlock(type); setShowPicker(false); }}
        onInsertPreset={(preset) => {
          const block = { id: crypto.randomUUID().slice(0, 10), type: preset.type, data: preset.data } as any;
          setBlocks((prev) => [...prev, block]);
          setShowPicker(false);
        }}
      />

      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted transition hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar bloco
      </button>

      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-xs text-rosa-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Guardado!</p>}
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
