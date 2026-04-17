import { useEffect, useRef, useState } from "react";
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
  onDirtyChange?: (id: string, dirty: boolean) => void;
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
  onDirtyChange,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const menuWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuWrapperRef.current && !menuWrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onClickSaveAsPreset = () => {
    setPresetName("");
    setPresetModalOpen(true);
    setMenuOpen(false);
  };

  const confirmSaveAsPreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setSavingPreset(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/block-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: block.type, data: block.data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`);
      }
      setPresetModalOpen(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar preset");
    } finally {
      setSavingPreset(false);
    }
  };

  const handleFormChange = (data: any) => {
    onChange({ ...block, data: { ...block.data, ...data } });
    setDirty(true);
    setJustSaved(false);
    onDirtyChange?.(block.id, true);
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
      onDirtyChange?.(block.id, false);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-ink-line bg-surface">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rosa-200 rounded"
          aria-expanded={expanded}
          aria-label={blockLabel(block.type)}
        >
          <span className="rounded-full bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {blockLabel(block.type)}
          </span>
          <span className="text-xs text-ink-muted">{expanded ? "▼" : "▶"}</span>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↑</button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30">↓</button>
          <div className="relative" ref={menuWrapperRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mais opções"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="block-card-menu"
              className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500"
            >
              ⋯
            </button>
            {menuOpen && (
              <div role="menu" id="block-card-menu" className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-ink-line bg-surface p-1 shadow-lg">
                <button
                  role="menuitem"
                  type="button"
                  onClick={onClickSaveAsPreset}
                  disabled={savingPreset}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-soft hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-40"
                >
                  {savingPreset ? "A guardar…" : "Guardar como bloco personalizado"}
                </button>
              </div>
            )}
          </div>
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

      {presetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Guardar bloco personalizado"
        >
          <div className="w-[min(420px,95vw)] rounded-3xl border border-ink-line bg-surface p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-ink">Guardar como bloco personalizado</h3>
            <p className="mt-1 text-xs text-ink-muted">Dá um nome para poderes reutilizar este bloco.</p>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              autoFocus
              placeholder="Ex: Hero da home"
              className="field-input mt-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && presetName.trim()) confirmSaveAsPreset();
                if (e.key === "Escape") setPresetModalOpen(false);
              }}
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                disabled={savingPreset}
                className="rounded-full border border-ink-line px-4 py-2 text-sm text-ink-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSaveAsPreset}
                disabled={!presetName.trim() || savingPreset}
                className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
              >
                {savingPreset ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
