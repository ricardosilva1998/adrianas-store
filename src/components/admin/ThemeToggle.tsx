import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function readInitial(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function persist(theme: Theme) {
  try {
    localStorage.setItem("adriana-admin-theme", theme);
  } catch {
    // ignore
  }
  document.cookie = `adriana-admin-theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    setTheme(readInitial());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    persist(next);
  };

  const label = theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro";
  const icon = theme === "dark" ? "☀" : "◐";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-sm text-ink-soft hover:border-rosa-300 hover:text-rosa-500"
    >
      {icon}
    </button>
  );
}
