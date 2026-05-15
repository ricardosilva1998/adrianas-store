import { useMemo, useState } from "react";
import type { Globals, SiteConfig } from "../../lib/config";
import DragList from "./DragList";
import PreviewShell from "./PreviewShell";
import { RichTextEditor } from "./RichTextEditor";
import ColorPicker from "./ColorPicker";
import { hashContentAsync } from "../../lib/banner-hash";
import { sanitizeAnnouncement } from "../../lib/sanitize";

interface Props {
  initialConfig: SiteConfig;
}

type Tab = "identity" | "nav" | "footer" | "banner" | "payments" | "notifications";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Identidade" },
  { id: "nav", label: "Navegação" },
  { id: "footer", label: "Footer" },
  { id: "banner", label: "Banner" },
  { id: "payments", label: "Pagamentos" },
  { id: "notifications", label: "Alertas admin" },
];

export default function GlobalsEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [tab, setTab] = useState<Tab>("identity");

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );

  // Accepts a partial patch OR an updater receiving the latest globals — the
  // updater form is essential for callers like RichTextEditor's onUpdate
  // closure, which sticks to the editor's initial render and would otherwise
  // overwrite the globals snapshot with stale data on every keystroke.
  const setGlobals = (
    patch: Partial<Globals> | ((g: Globals) => Partial<Globals>),
  ) =>
    setConfig((c) => ({
      ...c,
      globals: {
        ...c.globals,
        ...(typeof patch === "function" ? patch(c.globals) : patch),
      },
    }));

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
              tab === t.id ? "bg-ink text-white dark:bg-rosa-500" : "text-ink-soft hover:bg-rosa-50 dark:hover:bg-rosa-500/10"
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
        {tab === "notifications" && <NotificationsForm config={config} setGlobals={setGlobals} />}
      </div>
    </PreviewShell>
  );
}

interface FormProps {
  config: SiteConfig;
  setGlobals: (
    patch: Partial<Globals> | ((g: Globals) => Partial<Globals>),
  ) => void;
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
      <Field label="Redes sociais" value={identity.instagram} onChange={(instagram) => patch({ instagram })} />
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
      <p className="mb-3 text-xs text-ink-muted">
        Arrasta o ícone <span className="font-semibold text-ink-soft">⠿</span> para reordenar os itens do menu.
      </p>
      <DragList
        items={nav}
        getId={(_, i) => `nav-${i}`}
        onReorder={(next) => setGlobals({ nav: next })}
        renderItem={(link, i, handle) => (
          <div className="flex items-center gap-2 rounded-lg border border-ink-line bg-surface p-2">
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
          <div className="rounded-lg border border-ink-line bg-surface p-3">
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
  // Functional updater so async callers (hashContentAsync .then) and the
  // TipTap onUpdate closure — both of which capture an initial banner
  // snapshot — still merge against the latest banner state.
  const patch = (p: Partial<Globals["banner"]>) =>
    setGlobals((g) => ({ banner: { ...g.banner, ...p } }));

  const brandingPresets = useMemo(() => {
    const presets: Array<{ label: string; hex: string }> = [
      { label: "Primária", hex: config.theme.colors.primary },
      { label: "Neutra", hex: config.theme.colors.neutral },
    ];
    if (config.theme.colors.accent) {
      presets.push({ label: "Destaque", hex: config.theme.colors.accent });
    }
    presets.push(
      { label: "Branco", hex: "#FFFFFF" },
      { label: "Preto", hex: "#111111" },
    );
    return presets;
  }, [
    config.theme.colors.primary,
    config.theme.colors.neutral,
    config.theme.colors.accent,
  ]);

  const handleContentChange = (html: string) => {
    patch({ contentHtml: html });
    void hashContentAsync(html).then((v) => patch({ contentVersion: v }));
  };

  const previewHtml = useMemo(
    () => sanitizeAnnouncement(banner.contentHtml),
    [banner.contentHtml],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink">Barra de anúncio</h3>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={banner.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Mostrar barra
      </label>

      <div>
        <label className="field-label">Conteúdo</label>
        <div className="mt-1">
          <RichTextEditor
            mode="inline"
            value={banner.contentHtml}
            onChange={handleContentChange}
            minHeight={56}
            placeholder="Frete grátis ≥ €20 · Ver coleção…"
          />
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Apenas negrito, itálico, sublinhado, cor e links são suportados.
        </p>
      </div>

      <ColorPicker
        label="Cor de fundo"
        value={banner.bgHex}
        onChange={(bgHex) => patch({ bgHex })}
        showScale={false}
        presets={brandingPresets}
      />

      <ColorPicker
        label="Cor de texto"
        value={banner.textHex}
        onChange={(textHex) => patch({ textHex })}
        showScale={false}
        presets={brandingPresets}
      />

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={banner.dismissible}
          onChange={(e) => patch({ dismissible: e.target.checked })}
        />
        Permitir fechar (reaparece quando o conteúdo mudar)
      </label>

      <div>
        <label className="field-label">Pré-visualização</label>
        <div
          className="mt-1 rounded-lg border border-ink-line px-4 py-2 text-center text-xs [&_a]:underline [&_a]:underline-offset-2"
          style={{ background: banner.bgHex, color: banner.textHex }}
          dangerouslySetInnerHTML={{ __html: previewHtml || "&nbsp;" }}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Assim aparece na loja (sem o botão de fechar).
        </p>
      </div>
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
        <div className="space-y-2 rounded-lg border border-ink-line bg-surface p-3">
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

function NotificationsForm({ config, setGlobals }: FormProps) {
  const emails = config.globals.notifyEmails ?? [];
  const setEmails = (next: string[]) => setGlobals({ notifyEmails: next });

  const update = (i: number, value: string) => {
    const next = [...emails];
    next[i] = value.trim();
    setEmails(next);
  };
  const remove = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));
  const add = () => setEmails([...emails, ""]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        Cada encomenda nova envia um email de alerta para os administradores listados aqui.
        Se a lista estiver vazia, é usado o destinatário configurado em <code>ADMIN_NOTIFY_EMAIL</code>.
      </p>
      {emails.length === 0 && (
        <p className="text-xs italic text-ink-muted">
          Sem destinatários — apenas o do <code>.env</code> recebe alertas.
        </p>
      )}
      {emails.map((email, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => update(i, e.target.value)}
            placeholder="admin@example.com"
            className="field-input flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-full border border-ink-line px-3 py-2 text-xs font-medium text-ink-soft hover:border-red-300 hover:text-red-500"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-full border border-ink-line px-4 py-2 text-xs font-medium text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
      >
        + Adicionar destinatário
      </button>
    </div>
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
      <div className="mt-2">
        <RichTextEditor
          value={value}
          onChange={onChange}
          minHeight={120}
        />
      </div>
    </div>
  );
}
