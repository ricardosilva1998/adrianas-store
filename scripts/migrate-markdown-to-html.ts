import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import * as schema from "../src/db/schema";
import { sanitizeHtml } from "../src/lib/sanitize";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!url) {
  console.error("DATABASE_URL não configurado");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const HTML_TAG_RE = /<(p|h[1-6]|ul|ol|li|strong|em|b|i|u|s|span|div|br|blockquote|a|hr|pre|code)[\s>/]/i;

function looksLikeHtml(s: string): boolean {
  return HTML_TAG_RE.test(s.trim());
}

function mdToHtml(markdown: string): string {
  const parsed = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(parsed);
}

function migrateBlocks(blocks: unknown[]): { blocks: unknown[]; changed: boolean } {
  let changed = false;
  const out = blocks.map((b) => {
    const block = b as { type?: string; data?: Record<string, unknown> };
    if (!block || (block.type !== "text" && block.type !== "image-text-split")) return b;
    const data = block.data ?? {};
    const markdown = typeof data.markdown === "string" ? data.markdown : "";
    const existingHtml = typeof data.html === "string" ? data.html : "";
    if (existingHtml) {
      if (data.markdown !== undefined) {
        const { markdown: _omit, ...rest } = data;
        changed = true;
        return { ...block, data: rest };
      }
      return b;
    }
    if (!markdown) return b;
    const { markdown: _omit, ...rest } = data;
    changed = true;
    return { ...block, data: { ...rest, html: mdToHtml(markdown) } };
  });
  return { blocks: out, changed };
}

async function migratePages() {
  console.log("» Pages…");
  const pages = await db.select().from(schema.pages);
  let touched = 0;
  for (const page of pages) {
    const publicBlocks = Array.isArray(page.blocks) ? (page.blocks as unknown[]) : [];
    const draftBlocks = Array.isArray(page.draftBlocks) ? (page.draftBlocks as unknown[]) : null;
    const migratedPublic = migrateBlocks(publicBlocks);
    const migratedDraft = draftBlocks ? migrateBlocks(draftBlocks) : { blocks: null, changed: false };
    if (migratedPublic.changed || migratedDraft.changed) {
      await db
        .update(schema.pages)
        .set({
          blocks: migratedPublic.blocks as never,
          draftBlocks: (migratedDraft.blocks as never) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.pages.slug, page.slug));
      console.log(`  ✓ ${page.slug}`);
      touched += 1;
    }
  }
  console.log(`  ${touched} página(s) atualizada(s).`);
}

async function migrateTemplates() {
  console.log("» Templates…");
  const templates = await db.select().from(schema.templates);
  let touched = 0;
  for (const tpl of templates) {
    const blocks = Array.isArray(tpl.blocks) ? (tpl.blocks as unknown[]) : [];
    const migrated = migrateBlocks(blocks);
    if (migrated.changed) {
      await db
        .update(schema.templates)
        .set({ blocks: migrated.blocks as never, updatedAt: new Date() })
        .where(eq(schema.templates.id, tpl.id));
      console.log(`  ✓ template #${tpl.id} (${tpl.name})`);
      touched += 1;
    }
  }
  console.log(`  ${touched} template(s) atualizado(s).`);
}

async function migrateSlots() {
  console.log("» Slots…");
  const slots = await db.select().from(schema.slots);
  let touched = 0;
  for (const slot of slots) {
    const blocks = Array.isArray(slot.blocks) ? (slot.blocks as unknown[]) : [];
    const migrated = migrateBlocks(blocks);
    if (migrated.changed) {
      await db
        .update(schema.slots)
        .set({ blocks: migrated.blocks as never, updatedAt: new Date() })
        .where(eq(schema.slots.name, slot.name));
      console.log(`  ✓ slot ${slot.name}`);
      touched += 1;
    }
  }
  console.log(`  ${touched} slot(s) atualizado(s).`);
}

async function migrateProducts() {
  console.log("» Products longDescription…");
  const products = await db.select().from(schema.products);
  let touched = 0;
  for (const p of products) {
    const raw = p.longDescription ?? "";
    if (!raw.trim()) continue;
    if (looksLikeHtml(raw)) continue;
    const html = mdToHtml(raw);
    await db
      .update(schema.products)
      .set({ longDescription: html, updatedAt: new Date() })
      .where(eq(schema.products.id, p.id));
    console.log(`  ✓ ${p.slug}`);
    touched += 1;
  }
  console.log(`  ${touched} produto(s) atualizado(s).`);
}

async function main() {
  console.log("A migrar conteúdo Markdown → HTML…");
  await migratePages();
  await migrateTemplates();
  await migrateSlots();
  await migrateProducts();
  console.log("Concluído.");
}

main()
  .catch((err) => {
    console.error("Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
