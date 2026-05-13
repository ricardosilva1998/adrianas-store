import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../db/client";
import { eq } from "drizzle-orm";
import {
  hashCustomerPassword,
  createCustomerToken,
  setCustomerCookie,
} from "../../../lib/customer-auth";
import {
  isValidAddress,
  isValidName,
  isValidPtPhone,
  normalizePhone,
} from "../../../lib/customer-validation";
import { isFormatValid, lookupPostalCode, normalizePostalCode } from "../../../lib/postal-code";

export const prerender = false;

const Schema = z.object({
  name: z.string().refine((v) => v === "" || isValidName(v), "Nome inválido.").optional(),
  phone: z
    .string()
    .refine((v) => v === "" || isValidPtPhone(v), "Telemóvel inválido (9 dígitos PT).")
    .optional(),
  address: z
    .string()
    .refine((v) => v === "" || isValidAddress(v), "Morada inválida (mínimo 5 caracteres).")
    .optional(),
  postalCode: z
    .string()
    .refine((v) => v === "" || isFormatValid(v), "Código postal inválido.")
    .optional(),
  city: z.string().max(200).optional(),
  nif: z.string().max(20).nullable().optional(),
  password: z.string().min(8).max(200).optional(),
});

export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.customer) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return new Response(
      JSON.stringify({ error: first }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const d = parsed.data;

  // Existence check on postal code if it's being changed to a non-empty value.
  if (d.postalCode && d.postalCode !== "") {
    const postal = await lookupPostalCode(d.postalCode);
    if (!postal.ok && postal.reason === "not-found") {
      return new Response(
        JSON.stringify({ error: "Código postal não existe." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) updates.name = d.name.trim();
  if (d.phone !== undefined) updates.phone = d.phone ? normalizePhone(d.phone) : "";
  if (d.address !== undefined) updates.address = d.address.trim();
  if (d.postalCode !== undefined) {
    updates.postalCode = d.postalCode ? (normalizePostalCode(d.postalCode) ?? d.postalCode) : "";
  }
  if (d.city !== undefined) updates.city = d.city.trim();
  if (d.nif !== undefined) updates.nif = d.nif ? d.nif.trim() : null;
  if (d.password) updates.passwordHash = await hashCustomerPassword(d.password);

  const [updated] = await db
    .update(schema.customers)
    .set(updates)
    .where(eq(schema.customers.id, locals.customer.id))
    .returning();

  if (!updated) {
    return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404 });
  }

  if (d.name !== undefined) {
    const token = await createCustomerToken({
      id: updated.id,
      email: updated.email,
      name: updated.name,
    });
    setCustomerCookie(cookies, token);
  }

  return new Response(
    JSON.stringify({
      success: true,
      customer: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
        postalCode: updated.postalCode,
        city: updated.city,
        nif: updated.nif,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
