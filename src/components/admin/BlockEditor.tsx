import { useState } from "react";
import type { Block, BlockType } from "../../lib/blocks";
import { BLOCK_TYPES, createBlock } from "../../lib/blocks";
import BlockForm from "./BlockForm";

interface Props {
  slug: string;
  title: string;
  blocks: Block[];
  published: boolean;
  mode: "create" | "edit";
  hasDraft?: boolean;
}

export default function BlockEditor({
  slug: initialSlug,
  title: initialTitle,
  blocks: initialBlocks,
  published: initialPublished,
  mode,
  hasDraft: initialHasDraft = false,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [published, setPublished] = useState(initialPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasDraft, setHasDraft] = useState<boolean>(initialHasDraft);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(
    initialBlocks[0]?.id ?? null,
  );
  const [showPicker, setShowPicker] = useState(false);

  const updateBlock = (id: string, data: any) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...data } } : b)),
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
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

  const autoSlug = (value: string) => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (mode === "create") {
      setSlug(autoSlug(value));
    }
  };

  const makeSave = (saveAsDraft: boolean) => async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const url =
        mode === "create" ? "/api/admin/pages" : `/api/admin/pages/${initialSlug}`;
      const method = mode === "create" ? "POST" : "PUT";
      const payload: any = { title, blocks, published };
      if (mode === "create") payload.slug = slug;
      if (mode === "edit") payload.saveAsDraft = saveAsDraft;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      if (mode === "create") {
        const data = await res.json();
        window.location.href = `/admin/pages/${data.slug}`;
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      setHasDraft(saveAsDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  const blockLabel = (type: BlockType) =>
    BLOCK_TYPES.find((bt) => bt.type === type)?.label ?? type;

  return (
    <div className="grid gap-6">
      {/* Page settings */}
      <div className="rounded-3xl border border-ink-line bg-surface p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="title">Titulo</label>
            <input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="slug">Slug (URL)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="field-input"
                readOnly={mode === "edit"}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-ink-line text-rosa-500 focus:ring-rosa-500"
            />
            Publicado
          </label>
        </div>
      </div>

      {/* Block list */}
      <div className="grid gap-4">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="rounded-3xl border border-ink-line bg-surface"
          >
            {/* Block header */}
            <div
              className="flex cursor-pointer items-center justify-between px-6 py-4"
              onClick={() =>
                setExpandedBlock(expandedBlock === block.id ? null : block.id)
              }
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
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
                  title="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, "down")}
                  disabled={idx === blocks.length - 1}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rosa-50 hover:text-rosa-500 disabled:opacity-30"
                  title="Mover para baixo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500"
                  title="Remover bloco"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Block form (expanded) */}
            {expandedBlock === block.id && (
              <div className="border-t border-ink-line px-6 py-5">
                <BlockForm block={block} onChange={(data) => updateBlock(block.id, data)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add block button / picker */}
      {showPicker ? (
        <div className="rounded-3xl border border-dashed border-rosa-300 bg-rosa-50/60 p-6">
          <h4 className="mb-4 text-sm font-semibold text-ink">Adicionar bloco</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.type}
                type="button"
                onClick={() => addBlock(bt.type)}
                className="rounded-2xl border border-ink-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow"
              >
                <span className="text-sm font-semibold text-ink">{bt.label}</span>
                <p className="mt-1 text-[11px] text-ink-muted">{bt.description}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="mt-4 text-xs text-ink-muted hover:text-rosa-500"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-3xl border border-dashed border-ink-line p-4 text-sm text-ink-muted transition hover:border-rosa-300 hover:text-rosa-500"
        >
          + Adicionar bloco
        </button>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-rosa-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">Guardado!</p>}
          {mode === "edit" && hasDraft && (
            <a
              href={`/${initialSlug === "home" ? "" : initialSlug}?draft=1`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-rosa-500 hover:underline"
            >
              Pré-visualizar rascunho ↗
            </a>
          )}
        </div>
        <div className="flex gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={makeSave(true)}
              disabled={saving}
              className="rounded-full border border-ink-line px-5 py-2 text-sm font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500 disabled:opacity-50"
            >
              {saving ? "A guardar..." : "Guardar rascunho"}
            </button>
          )}
          <button
            type="button"
            onClick={makeSave(false)}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "A guardar..." : mode === "create" ? "Criar pagina" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
