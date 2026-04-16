// Process-local map of preview tokens → pending SiteConfig.
// TTL: 10 minutes. On Railway (single Node worker per service), this works fine.
// Multi-worker deploys would need Redis or sticky sessions — re-evaluate then.

import { nanoid } from "nanoid";
import type { SiteConfig } from "./config";

type Entry = { value: SiteConfig; expiresAt: number };
const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Entry>();

function gc() {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}

export function putPreview(value: SiteConfig): string {
  gc();
  const token = nanoid(16);
  store.set(token, { value, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function upsertPreview(token: string, value: SiteConfig): void {
  gc();
  store.set(token, { value, expiresAt: Date.now() + TTL_MS });
}

export function getPreview(token: string): SiteConfig | null {
  gc();
  return store.get(token)?.value ?? null;
}

export function clearPreview(token: string): void {
  store.delete(token);
}

import type { Block } from "./blocks";

export type PagePreviewValue = {
  slug: string;
  title: string;
  blocks: Block[];
};

type PageEntry = { value: PagePreviewValue; expiresAt: number };
const pageStore = new Map<string, PageEntry>();

function pageGc() {
  const now = Date.now();
  for (const [token, entry] of pageStore) {
    if (entry.expiresAt <= now) pageStore.delete(token);
  }
}

export function putPagePreview(value: PagePreviewValue): string {
  pageGc();
  const token = nanoid(16);
  pageStore.set(token, { value, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function upsertPagePreview(token: string, value: PagePreviewValue): void {
  pageGc();
  pageStore.set(token, { value, expiresAt: Date.now() + TTL_MS });
}

export function getPagePreview(token: string): PagePreviewValue | null {
  pageGc();
  return pageStore.get(token)?.value ?? null;
}

export function clearPagePreview(token: string): void {
  pageStore.delete(token);
}
