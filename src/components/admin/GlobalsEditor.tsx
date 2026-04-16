import { useMemo, useState } from "react";
import type { Globals, SiteConfig } from "../../lib/config";
import DragList from "./DragList";
import PreviewShell from "./PreviewShell";

interface Props {
  initialConfig: SiteConfig;
}

type Tab = "identity" | "nav" | "footer" | "banner" | "payments";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Identidade" },
  { id: "nav", label: "Navegação" },
  { id: "footer", label: "Footer" },
  { id: "banner", label: "Banner" },
  { id: "payments", label: "Pagamentos" },
];

export default function GlobalsEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [tab, setTab] = useState<Tab>("identity");

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );

  const setGlobals = (patch: Partial<Globals>) =>
    setConfig((c) => ({ ...c, globals: { ...c.globals, ...patch } }));

  const handleSave = async () => {
    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    window.location.reload();
  };

  return (
    <PreviewShell
      initialConfig={initialConfig}
      currentConfig={config}
      isDirty={isDirty}
      previewPath="/"
      onSave={handleSave}
      onReset={() => setConfig(initialConfig)}
    >
      <div className="flex flex-wrap gap-1 border-b border-ink-line pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-rosa-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {tab === "identity" && <IdentityForm config={config} setGlobals={setGlobals} />}
        {tab === "nav" && <NavForm config={config} setGlobals={setGlobals} />}
        {tab === "footer" && <FooterForm config={config} setGlobals={setGlobals} />}
        {tab === "banner" && <BannerForm config={config} setGlobals={setGlobals} />}
        {tab === "payments" && <PaymentsForm config={config} setGlobals={setGlobals} />}
      </div>
    </PreviewShell>
  );
}

interface FormProps {
  config: SiteConfig;
  setGlobals: (patch: Partial<Globals>) => void;
}

function IdentityForm({ config, setGlobals }: FormProps) {
  const { identity } = config.globals;
  const patch = (p: Partial<Globals["identity"]>) => setGlobals({ identity: { ...identity, ...p } });
  return (
    <div className="space-y-3">
      <Field label="Nome da loja" value={identity.name} onChange={(name) => patch({ name })} />
      <Field label="Tagline" value={identity.tagline} onChange={(tagline) => patch({ tagline })} />
      <Textarea label="Descrição" value={identity.description} onChange={(description) => patch({ description })} />
      <Field label="Email" value={identity.email} onChange={(email) => patch({ email })} />
      <Field label="WhatsApp" value={identity.whatsapp} onChange={(whatsapp) => patch({ whatsapp })} />
      <Field label="Instagram" value={identity.instagram} onChange={(instagram) => patch({ instagram })} />
      <Field label="Transportadora" value={identity.shippingProvider} onChange={(shippingProvider) => patch({ shippingProvider })} />
      <Field label="Dias de preparação" value={identity.preparationDays} onChange={(preparationDays) => patch({ preparationDays })} />
    </div>
  );
}

function NavForm({ config, setGlobals }: FormProps) {
  const { nav } = config.globals;
  const update = (i: number, patch: Partial<Globals["nav"][number]>) =>
    setGlobals({ nav: nav.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const remove = (i: number) => setGlobals({ nav: nav.filter((_, idx) => idx !== i) });
  const add = () => setGlobals({ nav: [...nav, { href: "/", label: "Novo" }] });

  return (
    <div>
      <DragList
        items={nav}
        getId={(_, i) => `nav-${i}`}
        onReorder={(next) => setGlobals({ nav: next })}
        renderItem={(link, i, handle) => (
          <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-white p-2">
            {handle}
            <input
              value={link.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="field-input flex-1"
              placeholder="Rótulo"
            />
            <input
              value={link.href}
              onChange={(e) => update(i, { href: e.target.value })}
              className="field-input flex-1"
              placeholder="/caminho"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-red-500 hover:underline"
            >
              Remover
            </button>
          </div>
        )}
      />
      <button
        type="button"
        onClick={add}
        className="mt-3 w-full rounded-lg border border-dashed border-ink-line py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar item
      </button>
    </div>
  );
}

function FooterForm({ config, setGlobals }: FormProps) {
  const { footer } = config.globals;
  const setCol = (ci: number, patch: Partial<Globals["footer"]["columns"][number]>) =>
    setGlobals({
      footer: {
        ...footer,
        columns: footer.columns.map((c, i) => (i === ci ? { ...c, ...patch } : c)),
      },
    });
  const addCol = () =>
    setGlobals({
      footer: { ...footer, columns: [...footer.columns, { heading: "Nova coluna", links: [{ href: "/", label: "Link" }] }] },
    });
  const removeCol = (ci: number) =>
    setGlobals({ footer: { ...footer, columns: footer.columns.filter((_, i) => i !== ci) } });

  return (
    <div className="space-y-4">
      <DragList
        items={footer.columns}
        getId={(_, i) => `col-${i}`}
        onReorder={(next) => setGlobals({ footer: { ...footer, columns: next } })}
        renderItem={(col, ci, handle) => (
          <div className="rounded-lg border border-ink-line bg-white p-3">
            <div className="flex items-center gap-2">
              {handle}
              <input
                value={col.heading}
                onChange={(e) => setCol(ci, { heading: e.target.value })}
                className="field-input flex-1"
                placeholder="Título da coluna"
              />
              <button type="button" onClick={() => removeCol(ci)} className="text-xs text-red-500 hover:underline">
                Remover
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {col.links.map((l, li) => (
                <div key={li} className="flex gap-2">
                  <input
                    value={l.label}
                    onChange={(e) =>
                      setCol(ci, {
                        links: col.links.map((x, i) => (i === li ? { ...x, label: e.target.value } : x)),
                      })
                    }
                    className="field-input flex-1"
                    placeholder="Rótulo"
                  />
                  <input
                    value={l.href}
                    onChange={(e) =>
                      setCol(ci, {
                        links: col.links.map((x, i) => (i === li ? { ...x, href: e.target.value } : x)),
                      })
                    }
                    className="field-input flex-1"
                    placeholder="/caminho"
                  />
                  <button
                    type="button"
                    onClick={() => setCol(ci, { links: col.links.filter((_, i) => i !== li) })}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCol(ci, { links: [...col.links, { href: "/", label: "Novo" }] })}
                className="text-xs text-ink-soft hover:text-rosa-500"
              >
                + link
              </button>
            </div>
          </div>
        )}
      />
      <button
        type="button"
        onClick={addCol}
        className="w-full rounded-lg border border-dashed border-ink-line py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar coluna
      </button>
      <Field
        label="Texto inferior"
        value={footer.bottomText}
        onChange={(bottomText) => setGlobals({ footer: { ...footer, bottomText } })}
      />
    </div>
  );
}

function BannerForm({ config, setGlobals }: FormProps) {
  const { banner } = config.globals;
  const patch = (p: Partial<Globals["banner"]>) => setGlobals({ banner: { ...banner, ...p } });
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={banner.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
        Mostrar banner
      </label>
      <Field label="Texto" value={banner.text} onChange={(text) => patch({ text })} />
      <Field label="Link (opcional)" value={banner.linkUrl ?? ""} onChange={(v) => patch({ linkUrl: v || null })} />
      <div>
        <label className="field-label">Cor de fundo</label>
        <div className="mt-1 flex gap-2">
          {(["rosa", "ink"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => patch({ bgColor: c })}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs ${
                banner.bgColor === c ? "border-rosa-400 bg-rosa-50" : "border-ink-line"
              }`}
            >
              {c === "rosa" ? "Rosa" : "Escuro"}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={banner.dismissible} onChange={(e) => patch({ dismissible: e.target.checked })} />
        Permitir fechar
      </label>
    </div>
  );
}

function PaymentsForm({ config, setGlobals }: FormProps) {
  const { payments } = config.globals;
  const update = (i: number, patch: Partial<Globals["payments"][number]>) =>
    setGlobals({ payments: payments.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  return (
    <DragList
      items={payments}
      getId={(p) => `pay-${p.id}`}
      onReorder={(next) => setGlobals({ payments: next })}
      renderItem={(p, i, handle) => (
        <div className="space-y-2 rounded-lg border border-ink-line bg-white p-3">
          <div className="flex items-center gap-2">
            {handle}
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{p.id}</span>
            <input
              value={p.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="field-input flex-1"
              placeholder="Rótulo"
            />
          </div>
          <Textarea
            label="Instruções"
            value={p.instructions}
            onChange={(instructions) => update(i, { instructions })}
          />
        </div>
      )}
    />
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input mt-1"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="field-input mt-1 resize-y"
      />
    </div>
  );
}
