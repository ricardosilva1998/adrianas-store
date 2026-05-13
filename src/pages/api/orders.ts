import type { APIRoute } from "astro";
import { z } from "zod";
import { createOrder, sendNewOrderNotifications } from "../../lib/orders";
import type { PaymentMethodId } from "../../db/schema";
import {
  isValidAddress,
  isValidName,
  isValidPtPhone,
  normalizePhone,
} from "../../lib/customer-validation";
import { isFormatValid, lookupPostalCode, normalizePostalCode } from "../../lib/postal-code";

export const prerender = false;

const CheckoutSchema = z.object({
  customer: z.object({
    name: z.string().refine(isValidName, "Nome inválido."),
    email: z.string().email(),
    phone: z.string().refine(isValidPtPhone, "Telemóvel inválido. Indica 9 dígitos (PT)."),
    address: z.string().refine(isValidAddress, "Morada inválida (mínimo 5 caracteres)."),
    postalCode: z.string().refine(isFormatValid, "Código postal inválido (formato 0000-000)."),
    city: z.string().min(1).max(200),
    nif: z.string().optional().nullable(),
  }),
  paymentMethod: z.enum(["mbway", "transferencia", "paypal"]),
  notes: z.string().max(2000).optional().nullable(),
  couponCode: z.string().min(1).max(60).optional().nullable(),
  items: z
    .array(
      z.object({
        productSlug: z.string(),
        name: z.string(),
        unitPriceCents: z.number().int().nonnegative(),
        quantity: z.number().int().min(1).max(100),
        image: z.string().optional().nullable(),
        personalization: z
          .object({
            phrase: z.string(),
            colors: z.array(z.string()),
            description: z.string(),
            attachment: z
              .object({
                url: z.string().url(),
                name: z.string().min(1).max(200),
                kind: z.enum(["image", "pdf"]),
              })
              .optional(),
          })
          .optional()
          .nullable(),
        variantColor: z
          .object({ name: z.string(), hex: z.string() })
          .optional()
          .nullable(),
      }),
    )
    .min(1),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Postal code existence check (geoapi.pt). Soft-fail: only block on a
  // confirmed "not-found"; format is already guarded by Zod and a network
  // error shouldn't punish the customer.
  const postal = await lookupPostalCode(parsed.data.customer.postalCode);
  if (!postal.ok && postal.reason === "not-found") {
    return new Response(
      JSON.stringify({ error: "Código postal não existe. Verifica e tenta novamente." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const normalizedCustomer = {
    ...parsed.data.customer,
    name: parsed.data.customer.name.trim(),
    phone: normalizePhone(parsed.data.customer.phone),
    address: parsed.data.customer.address.trim(),
    postalCode: normalizePostalCode(parsed.data.customer.postalCode) ?? parsed.data.customer.postalCode,
    city: parsed.data.customer.city.trim(),
  };

  try {
    const { order, items } = await createOrder({
      customer: normalizedCustomer,
      paymentMethod: parsed.data.paymentMethod as PaymentMethodId,
      notes: parsed.data.notes,
      couponCode: parsed.data.couponCode ?? null,
      items: parsed.data.items,
    });

    sendNewOrderNotifications(order.id).catch((err) =>
      console.error("[orders] Falha a enviar notificações:", err),
    );

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          number: order.number,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[orders] Falha a criar encomenda:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao criar encomenda" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
