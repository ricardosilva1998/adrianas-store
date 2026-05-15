// Isomorphic Web Crypto wrapper used to compute contentVersion on the client.
// Server code uses hashContentSync from ./legacy-banner.ts (which imports
// node:crypto). This file is intentionally free of node-only imports so it
// ships to admin React islands without dragging node:crypto into the bundle.
// hashContentAsync(input) MUST produce the same string as hashContentSync(input).

export async function hashContentAsync(html: string): Promise<string> {
  const data = new TextEncoder().encode(html);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let b64: string;
  if (typeof btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    b64 = btoa(bin);
  } else {
    b64 = Buffer.from(bytes).toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 12);
}
