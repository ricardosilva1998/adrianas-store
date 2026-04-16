import { useEffect, useMemo, useState } from "react";
import { blocksAllowedIn, type BlockType } from "../../lib/blocks";
import BlockIllustration from "./block-illustrations/BlockIllustration";

type Context = "page" | "template-catalog" | "template-product-detail";

type Preset = { id: number; name: string; type: BlockType; data: any };

interface Props {
  open: boolean;
  context: Context;
  onClose: () => void;
  onInsertBlockType: (type: BlockType) => void;
  onInsertPreset: (preset: Preset) => void;
}

export default function BlockPickerDialog({ open, context, onClose, onInsertBlockType, onInsertPreset }: Props) {
  const [tab, setTab] = useState<"blocos" | "presets">("blocos");
  const [selectedType, setSelectedType] = useState<BlockType | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const allowed = useMemo(() => blocksAllowedIn(context), [context]);

  useEffect(() => {
    if (!open || tab !== "presets") return;
    let cancelled = false;
    (async () => {
      setLoadingPresets(true);
      try {
        const res = await fetch(`/api/admin/block-presets?context=${context}`);
        if (!res.ok) return;
        const data = (await res.json()) as Preset[];
        if (!cancelled) setPresets(data);
      } finally {
        if (!cancelled) setLoadingPresets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, context]);

  if (!open) return null;

  const previewSrc = selectedPreset
    ? `/admin/block-preview/${selectedPreset.type}?data=${encodeURIComponent(JSON.stringify(selectedPreset.data))}`
    : selectedType
      ? `/admin/block-preview/${selectedType}`
      : "";

  const insert = () => {
    if (tab === "blocos" && selectedType) onInsertBlockType(selectedType);
    if (tab === "presets" && selectedPreset) onInsertPreset(selectedPreset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
      <div className="flex h-[85vh] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-3xl border border-ink-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-line px-6 py-4">
          <div role="tablist" className="flex gap-1 rounded-full border border-ink-line p-1">
            <button role="tab" aria-selected={tab === "blocos"} onClick={() => setTab("blocos")} className={`px-4 py-1 text-sm font-medium rounded-full ${tab === "blocos" ? "bg-ink text-white" : "text-ink-soft"}`}>Blocos</button>
            <button role="tab" aria-selected={tab === "presets"} onClick={() => setTab("presets")} className={`px-4 py-1 text-sm font-medium rounded-full ${tab === "presets" ? "bg-ink text-white" : "text-ink-soft"}`}>Meus blocos</button>
          </div>
          <button onClick={onClose} className="text-sm text-ink-muted hover:text-rosa-500">Fechar ✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 overflow-y-auto border-r border-ink-line p-6">
            {tab === "blocos" ? (
              <div className="grid grid-cols-2 gap-3">
                {allowed.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => setSelectedType(bt.type)}
                    className={`rounded-2xl border p-3 text-left transition ${selectedType === bt.type ? "border-rosa-400 bg-rosa-50" : "border-ink-line hover:border-rosa-300"}`}
                  >
                    <div className="mb-2 aspect-[5/3] overflow-hidden rounded-xl bg-rosa-50/40">
                      <BlockIllustration type={bt.type} />
                    </div>
                    <div className="text-sm font-semibold text-ink">{bt.label}</div>
                    <div className="text-[11px] text-ink-muted">{bt.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {loadingPresets && <div className="text-sm text-ink-muted">A carregar…</div>}
                {!loadingPresets && presets.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-ink-line p-6 text-sm text-ink-muted">
                    Ainda não tens blocos personalizados. Clica em "Guardar como bloco personalizado" dentro de qualquer bloco para começar.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p)}
                      className={`rounded-2xl border p-3 text-left transition ${selectedPreset?.id === p.id ? "border-rosa-400 bg-rosa-50" : "border-ink-line hover:border-rosa-300"}`}
                    >
                      <div className="mb-2 aspect-[5/3] overflow-hidden rounded-xl bg-rosa-50/40">
                        <BlockIllustration type={p.type} />
                      </div>
                      <div className="text-sm font-semibold text-ink">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-rosa-600">{p.type}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex w-1/2 flex-col">
            <div className="flex-1 overflow-hidden bg-ink-line/40">
              {previewSrc ? (
                <iframe src={previewSrc} title="Preview" className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">Seleciona um bloco para pré-visualizar</div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-line p-4">
              <button onClick={onClose} className="rounded-full border border-ink-line px-4 py-2 text-sm text-ink-soft">Cancelar</button>
              <button
                onClick={insert}
                disabled={!(tab === "blocos" ? selectedType : selectedPreset)}
                className="rounded-full bg-rosa-400 px-5 py-2 text-sm font-medium text-white hover:bg-rosa-500 disabled:opacity-40"
              >
                Inserir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
