import { blockSchema, type Block } from "./blocks";

export type MutationResult = { ok: true; blocks: Block[] } | { ok: false; blocks: Block[] };

export function replaceBlockData(
  blocks: Block[],
  id: string,
  data: unknown,
): MutationResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return { ok: false, blocks };
  const candidate = { ...blocks[idx], data: { ...(blocks[idx].data as object), ...(data as object) } };
  const parsed = blockSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, blocks };
  const next = blocks.slice();
  next[idx] = parsed.data;
  return { ok: true, blocks: next };
}

export function appendBlock(blocks: Block[], block: unknown): MutationResult {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) return { ok: false, blocks };
  return { ok: true, blocks: [...blocks, parsed.data] };
}

export function removeBlockById(blocks: Block[], id: string): MutationResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return { ok: false, blocks };
  return { ok: true, blocks: blocks.filter((b) => b.id !== id) };
}

export function reorderBlocks(blocks: Block[], ids: string[]): MutationResult {
  if (ids.length !== blocks.length) return { ok: false, blocks };
  const byId = new Map(blocks.map((b) => [b.id, b]));
  if (ids.some((id) => !byId.has(id))) return { ok: false, blocks };
  return { ok: true, blocks: ids.map((id) => byId.get(id)!) };
}
