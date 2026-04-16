# Phase 3: Admin Dark Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark-mode toggle to the admin dashboard. Admin routes only; storefront (and all storefront preview iframes) always render with the merchant theme.

**Architecture:** A small set of CSS-var overrides on `html.dark` swaps the admin surface colors. Two new tokens (`--color-surface`, `--color-surface-muted`) replace literal `bg-white` / `bg-rosa-50/30` in the admin component tree. A tiny React island writes the user's choice to both `localStorage` and a cookie; `AdminLayout.astro` reads the cookie server-side and adds the `dark` class to `<html>` at SSR, plus an inline pre-paint script that applies the class before first paint for fresh visits. The storefront never reads the cookie, so it stays in the merchant theme regardless of admin preference.

**Tech Stack:** Tailwind v4 `@theme` CSS vars, Astro SSR, React 19 island, Vitest + RTL (from Phase 0).

**Prerequisites:** Phase 0 installed (`npm test` works). Other phases not required, but if Phase 1 or 2 landed first the admin-component sweep must also cover `PagePreviewShell.tsx`, `PageEditor.tsx`, `BlockCard.tsx`, and `BlockPickerDialog.tsx`.

---

### Task 1: Add surface tokens + `.dark` overrides to `global.css`

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the new tokens inside `@theme`**

Inside the existing `@theme { ... }` block, right after the `--color-ink-line` line, add:
```css
--color-surface: #ffffff;
--color-surface-muted: #faf7f8;
```

- [ ] **Step 2: Add the dark override block**

Immediately after the `@theme { ... }` block closes, add:
```css
html.dark {
  --color-ink: #f4f4f5;
  --color-ink-soft: #c4c4c7;
  --color-ink-muted: #8a8a94;
  --color-ink-line: #2b2b31;
  --color-surface: #1c1c22;
  --color-surface-muted: #16161a;
}

html.dark,
html.dark body {
  background: var(--color-surface-muted);
}
```

- [ ] **Step 3: Dev-server check (light only, no visual change yet)**

Run (if not already): `npm run dev`. Open `/admin`. Confirm it still renders as before — no class `dark` is applied yet.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(theme): add surface tokens + html.dark overrides"
```

---

### Task 2: `ThemeToggle` React island (TDD)

**Files:**
- Create: `src/components/admin/ThemeToggle.tsx`
- Create: `src/components/admin/ThemeToggle.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/admin/ThemeToggle.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    document.cookie = "adriana-admin-theme=; Max-Age=0; Path=/";
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the current mode from the html.dark class on mount", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /mudar para modo claro/i })).toBeInTheDocument();
  });

  it("toggling adds html.dark and writes localStorage + cookie", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /mudar para modo escuro/i });
    await user.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("adriana-admin-theme")).toBe("dark");
    expect(document.cookie).toContain("adriana-admin-theme=dark");
  });

  it("toggling again returns to light", async () => {
    const user = userEvent.setup();
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /mudar para modo claro/i }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("adriana-admin-theme")).toBe("light");
    expect(document.cookie).toContain("adriana-admin-theme=light");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- ThemeToggle`
Expected: fails on missing module.

- [ ] **Step 3: Implement the toggle**

```tsx
// src/components/admin/ThemeToggle.tsx
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ThemeToggle`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ThemeToggle.tsx src/components/admin/ThemeToggle.test.tsx
git commit -m "feat(admin): ThemeToggle island with cookie + localStorage persistence"
```

---

### Task 3: `AdminLayout` reads the cookie + embeds the toggle + no-flash script

**Files:**
- Modify: `src/layouts/AdminLayout.astro`

- [ ] **Step 1: Read the cookie during SSR and add `.dark`**

At the top of the frontmatter (after the existing `const currentPath = Astro.url.pathname;` line), add:
```ts
const themeCookie = Astro.cookies.get("adriana-admin-theme")?.value;
const initialTheme: "dark" | "light" | null =
  themeCookie === "dark" || themeCookie === "light" ? themeCookie : null;
```

Change the opening `<html>` tag to:
```astro
<html lang="pt-PT" class={initialTheme === "dark" ? "dark" : undefined}>
```

- [ ] **Step 2: Add the no-flash script inside `<head>`**

Immediately after the `<meta name="viewport" ...>` line, add:
```astro
<script is:inline define:vars={{ initialTheme }}>
  // Only run this fallback when the cookie wasn't set (first visit).
  if (!initialTheme) {
    try {
      const stored = localStorage.getItem("adriana-admin-theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const effective = stored ?? (systemDark ? "dark" : "light");
      if (effective === "dark") document.documentElement.classList.add("dark");
    } catch {
      /* ignore */
    }
  }
</script>
```

- [ ] **Step 3: Embed the `ThemeToggle` in the header**

In the header section `<header class="sticky top-0 ...">`, inside the right-side `<div class="flex items-center gap-3 ...">`, add **before** the `<a href="/">Ver site →</a>` link:
```astro
<ThemeToggle client:load />
```

Add the import near the top of the frontmatter (next to other component imports if any, otherwise after the `import "../styles/global.css";` line):
```ts
import ThemeToggle from "../components/admin/ThemeToggle.tsx";
```

- [ ] **Step 4: Manual verification (happy path)**

Run `npm run dev`. Log in. Click the sun/moon icon in the header → admin goes dark. Reload → stays dark. Log out + log in → still dark. Open `/` in a new tab → storefront is light.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AdminLayout.astro
git commit -m "feat(admin): cookie-driven dark mode + no-flash script + toggle"
```

---

### Task 4: Admin component sweep — replace `bg-white` with `bg-surface`

**Files:**
- Modify: every admin component that uses literal `bg-white` on a container/card background
- Modify: `src/styles/global.css` (`.field-input`, `.card`)

- [ ] **Step 1: Find every `bg-white` in the admin tree**

Use Grep to locate:
- Path: `src/layouts/AdminLayout.astro`
- Path: `src/components/admin/**`
- Path: `src/pages/admin/**`

For each match, decide:
- **If the class marks a chrome/card surface that should re-theme in dark mode** → replace `bg-white` with `bg-surface`.
- **If the class marks a pill, a badge, or the storefront iframe's own body** → leave alone.

Common cases to replace (non-exhaustive):
- `AdminLayout.astro`: `<aside class="... bg-white md:flex">` → `bg-surface`.
- `AdminLayout.astro`: `<header class="... bg-white/90 ...">` → `bg-surface/90`.
- `AdminLayout.astro`: `<body class="... bg-rosa-50/30 ...">` → `bg-surface-muted`.
- `AdminLayout.astro`: mobile tab-bar `bg-white px-5 py-2` → `bg-surface`.
- `BlockEditor.tsx`, `BlockForm.tsx`, `BlockCard.tsx` (Phase 1), `PageEditor.tsx` (Phase 1), `PagePreviewShell.tsx` (Phase 1), `PreviewShell.tsx`, `TemplateEditor.tsx`, `SlotEditor.tsx`, `ProductForm.tsx`, `ThemeEditor.tsx`, `GlobalsEditor.tsx`, `MediaGallery.tsx`, `ImagePicker.tsx`, `BlockPickerDialog.tsx` (Phase 2): card containers `bg-white` → `bg-surface`.

Leave `text-ink` alone — once the background is dark, `text-ink` continues to work because `--color-ink` flips in dark mode.

- [ ] **Step 2: Update `.field-input` and `.card` utilities**

In `src/styles/global.css`, edit:
```css
.field-input {
  @apply mt-1 block w-full rounded-xl border border-ink-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-rosa-400 focus:outline-none focus:ring-2 focus:ring-rosa-200;
}
```
```css
.card {
  @apply relative flex h-full flex-col overflow-hidden rounded-3xl border border-ink-line bg-surface transition hover:-translate-y-0.5 hover:border-rosa-300 hover:shadow-[0_20px_40px_-20px_rgba(237,115,150,0.35)];
}
```

(`.card` is used on storefront cards too. It's still safe: storefront pages never get `html.dark`, so `bg-surface` always resolves to white for storefront renderings.)

- [ ] **Step 3: Dev-server verification**

Run `npm run dev`. Log in. Toggle dark mode. Navigate through:
- `/admin`
- `/admin/pages` and `/admin/pages/home`
- `/admin/products`
- `/admin/products/<any-slug>`
- `/admin/theme`
- `/admin/globals`
- `/admin/templates`
- `/admin/slots`
- `/admin/media`

Every admin page must be readable in both modes. Text contrast should remain acceptable.

Known expected behaviour:
- Storefront preview iframes (inside `/admin/theme`, `/admin/globals`, and — if Phase 1 landed — `/admin/pages/[slug]`) render with the merchant theme regardless of admin dark mode. This is correct.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test` — expected all green.
Run: `npm run check` — expected green.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/layouts/AdminLayout.astro src/components/admin src/pages/admin
git commit -m "style(admin): tokenize surface colors for dark mode"
```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Walkthrough**

1. Clear the `adriana-admin-theme` cookie and `localStorage` key.
2. Set macOS / browser to "Dark" appearance.
3. Load `/admin/login` (already logged out); the login page is public so it may not be dark. After login hit `/admin` → dark from the first paint (no white flash).
4. Toggle to light. Reload → stays light.
5. Close the browser, reopen `/admin` → preference restored (cookie).
6. Clear cookie + storage, set system to "Light", visit `/admin` → light mode.
7. Toggle to dark. Open `/` in a new tab → storefront is light (merchant theme).
8. Inside `/admin/theme`, the preview iframe shows the merchant theme — not dark — regardless of admin preference.

- [ ] **Step 2: Accessibility sanity check**

Pick three dark-mode admin pages and open devtools → Lighthouse or axe. No contrast failures on text/background pairs. If any fail, tweak `--color-ink-soft` / `--color-ink-muted` in `global.css` and commit.

- [ ] **Step 3: No commit (verification only).**

---

## Self-review checklist

- [ ] `npm test` green.
- [ ] `npm run check` green.
- [ ] `npm run build` succeeds.
- [ ] Spec coverage:
  - Admin-only scope ✓ (cookie read only in `AdminLayout`, not `BaseLayout`)
  - System-preference default + no flash ✓ (inline script in `<head>`)
  - Cookie + localStorage persistence ✓ (`ThemeToggle` + cookie)
  - Storefront untouched ✓ (`BaseLayout.astro` unchanged; iframes stay light)
- [ ] Placeholder scan: none.
- [ ] Type consistency: `Theme = "light" | "dark"` used consistently across `ThemeToggle.tsx` and `AdminLayout.astro` cookie parsing.
