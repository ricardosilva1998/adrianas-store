import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function persist(theme: Theme) {
  try {
    localStorage.setItem("adriana-admin-theme", theme);
  } catch {
    // ignore
  }
  document.cookie = `adriana-admin-theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export default function ThemeToggle() {
  // Start as null so SSR and first client render produce identical HTML —
  // React 19 is strict about hydration mismatches. The real theme is read
  // from the DOM in the first effect (runs after hydration completes).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    persist(next);
  };

  const label =
    theme === null
      ? "Alternar tema"
      : theme === "dark"
        ? "Mudar para modo claro"
        : "Mudar para modo escuro";
  const icon = theme === "dark" ? "☀" : "◐";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      disabled={theme === null}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-sm text-ink-soft hover:border-rosa-300 hover:text-rosa-500 disabled:opacity-40"
    >
      {icon}
    </button>
  );
}
