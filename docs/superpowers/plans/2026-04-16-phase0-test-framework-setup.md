# Phase 0: Test Framework Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest + React Testing Library so Phases 1–3 can practise TDD.

**Architecture:** Vitest runs in jsdom environment. Pure TS/business-logic tests live in `src/lib/**/*.test.ts`. React component tests live alongside components as `*.test.tsx`. No database involvement — we test pure functions and React behaviour only. API endpoints are thin wrappers around pure helpers that we unit test directly.

**Tech Stack:** Vitest 3.x, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom.

---

### Task 1: Install test dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install devDependencies**

Run:
```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` gains six new devDependencies; `node_modules` updates; no errors.

- [ ] **Step 2: Add npm scripts**

Edit `package.json` `scripts`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(test): install vitest, react-testing-library, jsdom"
```

---

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
```

Note: `@vitejs/plugin-react` is already pulled in transitively by `@astrojs/react`; if import fails, install with `npm install --save-dev @vitejs/plugin-react`.

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Update `tsconfig.json` to include vitest globals**

Add `"vitest/globals"` and `"@testing-library/jest-dom"` to `compilerOptions.types` (create the array if missing). Example:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

Also make sure `include` covers `vitest.config.ts` and `src/test/setup.ts`.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/test/setup.ts tsconfig.json
git commit -m "chore(test): vitest config + jsdom setup"
```

---

### Task 3: Prove the framework works with a smoke test

**Files:**
- Create: `src/lib/__smoke__.test.ts`
- Create: `src/test/__smoke_react__.test.tsx`

- [ ] **Step 1: Write a smoke test**

Create `src/lib/__smoke__.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("adds numbers", () => {
    expect(1 + 2).toBe(3);
  });

  it("has jsdom", () => {
    document.body.innerHTML = `<h1>ola</h1>`;
    expect(document.querySelector("h1")?.textContent).toBe("ola");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: two tests pass, exit 0.

- [ ] **Step 3: Add an RTL smoke test to prove React rendering works**

Create `src/test/__smoke_react__.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return <span>Olá {name}</span>;
}

describe("react smoke", () => {
  it("renders a component", () => {
    render(<Greeting name="Adriana" />);
    expect(screen.getByText("Olá Adriana")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests again**

Run: `npm test`

Expected: three tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__smoke__.test.ts src/test/__smoke_react__.test.tsx
git commit -m "test: smoke tests for vitest + react-testing-library"
```

---

### Task 4: Document the testing convention

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

In the `## Commands` section, right after the `npm run db:seed` line and before the `No test framework is configured.` line, insert:
```bash
npm test             # Run Vitest suite once
npm run test:watch   # Vitest in watch mode
```

Then **remove** the line `No test framework is configured.` and replace with:

> Tests: Vitest + React Testing Library. Unit tests live alongside their source (`src/lib/foo.ts` → `src/lib/foo.test.ts`; `src/components/admin/Foo.tsx` → `src/components/admin/Foo.test.tsx`). No database in tests — pure functions and component behaviour only.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark vitest as the project test framework"
```

---

## Self-review checklist

- [ ] `npm test` runs three passing tests from a clean clone.
- [ ] `npm run test:watch` starts watch mode without errors.
- [ ] No dependency added for features we don't yet need (no Playwright, no MSW).
- [ ] CLAUDE.md reflects reality.
