import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteConfig, Theme } from "../../lib/config";
import { renderGoogleFontsHref, renderThemeCSS } from "../../lib/config";
import ColorPicker from "./ColorPicker";
import FontPicker from "./FontPicker";
import ImagePicker from "./ImagePicker";
import PreviewShell from "./PreviewShell";

interface Props {
  initialConfig: SiteConfig;
}

const RADIUS_LABELS: Array<{ value: Theme["radius"]; label: string }> = [
  { value: "none", label: "Nenhum" },
  { value: "soft", label: "Suave" },
  { value: "rounded", label: "Arredondado" },
  { value: "pill", label: "Pill" },
];

export default function ThemeEditor({ initialConfig }: Props) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [accentOn, setAccentOn] = useState<boolean>(initialConfig.theme.colors.accent !== null);
  const iframeWinRef = useRef<Window | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig),
    [config, initialConfig],
  );

  const setTheme = (patch: Partial<Theme>) =>
    setConfig((c) => ({ ...c, theme: { ...c.theme, ...patch } }));

  // Live-push CSS + fonts to iframe via postMessage.
  useEffect(() => {
    const win = iframeWinRef.current;
    if (!win) return;
    try {
      win.postMessage(
        {
          kind: "preview-theme-css",
          css: renderThemeCSS(config.theme),
          fontsHref: renderGoogleFontsHref(config.theme.fonts),
        },
        "*",
      );
    } catch { /* iframe may not be ready */ }
  }, [config.theme]);

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
    // Treat save as successful — reload to pick up server-side config.
    window.location.reload();
  };

  return (
    <PreviewShell
      initialConfig={initialConfig}
      currentConfig={config}
      isDirty={isDirty}
      previewPath="/"
      onSave={handleSave}
      onReset={() => { setConfig(initialConfig); setAccentOn(initialConfig.theme.colors.accent !== null); }}
      onIframeReady={(win) => { iframeWinRef.current = win; }}
    >
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-ink">Cores</h2>
          <div className="mt-3 space-y-4">
            <ColorPicker
              label="Cor principal"
              value={config.theme.colors.primary}
              onChange={(primary) => setTheme({ colors: { ...config.theme.colors, primary } })}
            />
            <ColorPicker
              label="Cor neutra (texto)"
              value={config.theme.colors.neutral}
              onChange={(neutral) => setTheme({ colors: { ...config.theme.colors, neutral } })}
            />
            <div>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={accentOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setAccentOn(on);
                    setTheme({
                      colors: {
                        ...config.theme.colors,
                        accent: on ? (config.theme.colors.accent ?? "#22c55e") : null,
                      },
                    });
                  }}
                />
                Usar cor de acento
              </label>
              {accentOn && config.theme.colors.accent !== null && (
                <div className="mt-2">
                  <ColorPicker
                    label="Cor de acento"
                    value={config.theme.colors.accent}
                    onChange={(accent) => setTheme({ colors: { ...config.theme.colors, accent } })}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Tipografia</h2>
          <div className="mt-3 space-y-4">
            <FontPicker
              label="Corpo"
              value={config.theme.fonts.body}
              onChange={(body) => setTheme({ fonts: { ...config.theme.fonts, body } })}
            />
            <FontPicker
              label="Títulos"
              value={config.theme.fonts.display}
              onChange={(display) => setTheme({ fonts: { ...config.theme.fonts, display } })}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Logótipo</h2>
          <div className="mt-3 space-y-3">
            <ImagePicker
              label="Logótipo (deixa vazio para usar texto)"
              value={config.theme.logo.url ?? ""}
              onChange={(url) => setTheme({ logo: { ...config.theme.logo, url: url || null } })}
            />
            <label className="field-label">Texto alternativo</label>
            <input
              type="text"
              value={config.theme.logo.alt}
              onChange={(e) => setTheme({ logo: { ...config.theme.logo, alt: e.target.value } })}
              className="field-input"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink">Arredondamento</h2>
          <div className="mt-3 flex gap-2">
            {RADIUS_LABELS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setTheme({ radius: r.value })}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                  config.theme.radius === r.value
                    ? "border-rosa-400 bg-rosa-50 text-rosa-700 dark:bg-rosa-500/15 dark:text-rosa-200"
                    : "border-ink-line text-ink-soft hover:border-rosa-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </PreviewShell>
  );
}
