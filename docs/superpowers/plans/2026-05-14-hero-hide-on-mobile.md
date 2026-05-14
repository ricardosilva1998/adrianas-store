# Hero "Esconder na versão mobile" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-Hero-block toggle that hides the Hero on viewports below 768px while leaving desktop unchanged.

**Architecture:** A new optional `hideOnMobile` boolean on the hero block's Zod schema. `BlockRenderer.astro` — the single `<div>` wrapper that already wraps every block — adds the Tailwind class `hidden md:block` to that wrapper when a hero has `hideOnMobile: true`. An admin checkbox in `HeroForm` sets the field. No new files, no DB migration, no new dependencies.

**Tech Stack:** Astro SSR, React islands, Zod schemas, Tailwind CSS, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-14-hero-hide-on-mobile-design.md`

**Commit policy:** The user asked for the whole hero feature in a *single, separate commit*. Do **not** commit after each task — make exactly **one** commit, in Task 4, covering all five files. Stage the five files explicitly; never `git add -A` (`payment.md` must stay untracked).

---

## File Structure

| File | Change |
|---|---|
| `src/lib/blocks.ts` | Add `hideOnMobile: z.boolean().default(false)` to `heroDataSchema`; add `hideOnMobile: false` to the `createBlock("hero")` factory. |
| `src/lib/blocks.test.ts` | Two backward-compat tests for the new field. |
| `src/components/blocks/BlockRenderer.astro` | Compute a `hideOnMobile` flag; add `hidden md:block` to the wrapper `<div>` when set. |
| `src/components/admin/BlockForm.tsx` | Add the "Esconder na versão mobile" checkbox to `HeroForm`. |
| `src/components/admin/BlockForm.test.tsx` | One test: the checkbox toggles `hideOnMobile`. |

---

### Task 1: Schema field + backward-compat tests

**Files:**
- Modify: `src/lib/blocks.ts` (`heroDataSchema` ~line 43; `createBlock` hero case ~line 475)
- Test: `src/lib/blocks.test.ts` (inside `describe("backward compat on existing blocks")` ~line 37)

- [ ] **Step 1: Write the failing tests**

In `src/lib/blocks.test.ts`, inside `describe("backward compat on existing blocks", ...)`, immediately after the existing test `"hero block parses without the new layout field and gets default image-right"` (its closing `});` on line 37), insert:

```ts
  it("hero block parses without hideOnMobile and gets default false", () => {
    const old = { id: "h", type: "hero" as const, data: { title: "x", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "" } };
    const parsed = blockSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "hero") {
      expect(parsed.data.data.hideOnMobile).toBe(false);
    }
  });

  it("hero block accepts hideOnMobile set to true", () => {
    const block = { id: "h", type: "hero" as const, data: { title: "x", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", hideOnMobile: true } };
    const parsed = blockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "hero") {
      expect(parsed.data.data.hideOnMobile).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/blocks.test.ts`
Expected: FAIL — the two new tests fail (`expected undefined to be false` and `expected undefined to be true`). `heroDataSchema` has no `hideOnMobile` field, so Zod strips the unknown key and the parsed value is `undefined`.

- [ ] **Step 3: Add the schema field**

In `src/lib/blocks.ts`, in `heroDataSchema`, add the `hideOnMobile` line after the `layout` line. Change:

```ts
  layout: z.enum(["image-right", "image-left", "background-image", "centered", "carousel"]).default("image-right"),
});
```

to:

```ts
  layout: z.enum(["image-right", "image-left", "background-image", "centered", "carousel"]).default("image-right"),
  hideOnMobile: z.boolean().default(false),
});
```

- [ ] **Step 4: Add the field to the `createBlock` factory**

In `src/lib/blocks.ts`, in the `createBlock` function's `case "hero":`, add `hideOnMobile: false` at the end of the `data` object. Change:

```ts
    case "hero":
      return { id, type, data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", imageFocal: { x: 50, y: 50 }, imageUrlMobile: "", imageFocalMobile: { x: 50, y: 50 }, slides: [], layout: "image-right" } };
```

to:

```ts
    case "hero":
      return { id, type, data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", imageFocal: { x: 50, y: 50 }, imageUrlMobile: "", imageFocalMobile: { x: 50, y: 50 }, slides: [], layout: "image-right", hideOnMobile: false } };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/blocks.test.ts`
Expected: PASS — all tests in the file green, including the two new ones.

---

### Task 2: Renderer — hide the wrapper on mobile

**Files:**
- Modify: `src/components/blocks/BlockRenderer.astro` (frontmatter ~line 42 and the wrapper `<div>` ~line 44)

No unit test: `BlockRenderer.astro` is an Astro component and the project has no Astro-component test harness. It is verified by `npm run build` (Step 2 below, and again in Task 4) and a manual preview check.

- [ ] **Step 1: Add the `hideOnMobile` flag and apply the class**

In `src/components/blocks/BlockRenderer.astro`, change:

```astro
const { block, context } = Astro.props;
const attrs = block.id ? { "data-block-id": block.id } : {};
---
<div {...attrs}>
```

to:

```astro
const { block, context } = Astro.props;
const attrs = block.id ? { "data-block-id": block.id } : {};
const hideOnMobile = block.type === "hero" && block.data?.hideOnMobile === true;
---
<div {...attrs} class={hideOnMobile ? "hidden md:block" : undefined}>
```

`class={undefined}` renders no `class` attribute, so every non-hero block and every hero with the flag off renders byte-identically to before. `hidden md:block` is Tailwind for `display:none` below 768px and `display:block` at ≥768px.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: PASS — ends with `[build] Complete!` and no errors.

---

### Task 3: Admin form checkbox + test

**Files:**
- Modify: `src/components/admin/BlockForm.tsx` (`HeroForm`, between the Layout picker and the "Titulo" field, ~line 133)
- Test: `src/components/admin/BlockForm.test.tsx` (inside `describe("BlockForm(hero)")` ~line 20)

- [ ] **Step 1: Write the failing test**

In `src/components/admin/BlockForm.test.tsx`, inside `describe("BlockForm(hero)", ...)`, immediately after the existing `"calls onChange when title is edited"` test (its closing `});` on line 20), insert:

```tsx
  it("toggles hideOnMobile when the 'esconder na versão mobile' checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const block: Block = {
      id: "a",
      type: "hero",
      data: { title: "", titleAccent: "", subtitle: "", buttonText: "", buttonUrl: "", imageUrl: "", slides: [], layout: "image-right" as const, hideOnMobile: false },
    };
    render(<BlockForm block={block} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox", { name: /esconder na versão mobile/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ hideOnMobile: true });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/admin/BlockForm.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "checkbox" and name \`/esconder na versão mobile/i\``. The checkbox does not exist yet.

- [ ] **Step 3: Add the checkbox to `HeroForm`**

In `src/components/admin/BlockForm.tsx`, in `HeroForm`'s returned JSX, insert a new `<div>` between the Layout picker's closing tags and the "Titulo" field. Find this exact 4-line sequence:

```tsx
        </div>
      </div>
      <div>
        <label className="field-label">Titulo</label>
```

and change it to:

```tsx
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={data.hideOnMobile ?? false}
            onChange={(e) => onChange({ hideOnMobile: e.target.checked })}
          />
          Esconder na versão mobile
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          O hero deixa de aparecer em telemóveis (ecrãs com menos de 768px de largura). No computador continua visível normalmente.
        </p>
      </div>
      <div>
        <label className="field-label">Titulo</label>
```

(The first `</div>\n      </div>` closes the Layout picker's inner grid and outer wrapper; the new `<div>` is the checkbox block; the trailing `<div>` + `Titulo` label is the unchanged start of the existing "Titulo" field.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/admin/BlockForm.test.tsx`
Expected: PASS — both `BlockForm(hero)` tests green.

---

### Task 4: Full verification + single commit

**Files:** none modified — verification and commit only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS — **141 passed / 1 skipped** (138 baseline + 2 new in `blocks.test.ts` + 1 new in `BlockForm.test.tsx`).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS — ends with `[build] Complete!` and no errors.

- [ ] **Step 3: Commit (one commit for the whole feature)**

Stage exactly the five files and commit:

```bash
git add src/lib/blocks.ts src/lib/blocks.test.ts src/components/blocks/BlockRenderer.astro src/components/admin/BlockForm.tsx src/components/admin/BlockForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(hero): opção "esconder na versão mobile" por bloco

Novo campo hideOnMobile no heroDataSchema (default false). O
BlockRenderer aplica `hidden md:block` ao wrapper do bloco quando um
hero o tem ativo, escondendo-o abaixo de 768px e mantendo-o no
computador. Checkbox "Esconder na versão mobile" no editor do Hero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do NOT `git add -A` — `payment.md` must remain untracked. Do NOT push or deploy in this plan; that is a separate step the user will request.

---

## Self-Review

**1. Spec coverage:**
- Schema field on `heroDataSchema` → Task 1, Step 3 ✓
- `createBlock("hero")` factory updated → Task 1, Step 4 ✓
- `BlockRenderer.astro` applies `hidden md:block` → Task 2, Step 1 ✓
- Admin checkbox in `HeroForm` (placement, label, helper text) → Task 3, Step 3 ✓
- `blocks.test.ts` — default false + accepts true → Task 1, Step 1 ✓
- `BlockForm.test.tsx` — checkbox toggles `hideOnMobile` → Task 3, Step 1 ✓
- `BlockRenderer.astro` not unit-tested, verified by build → Task 2 Step 2 + Task 4 Step 2 ✓
- No new files, no DB migration → confirmed; nothing in the plan adds either ✓

**2. Placeholder scan:** No TBD/TODO. Every code step shows the full before/after. Exact file paths and run commands throughout.

**3. Type consistency:** `hideOnMobile` is a boolean everywhere — `z.boolean().default(false)` (schema), `false` (createBlock), `=== true` guard (renderer), `data.hideOnMobile ?? false` + `e.target.checked` (form), `true`/`false` (tests). Property name `hideOnMobile` is identical in all five files.
