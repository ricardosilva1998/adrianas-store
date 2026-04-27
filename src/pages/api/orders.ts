import type { APIRoute } from "astro";
import { z } from "zod";
import { createOrder, sendNewOrderNotifications } from "../../lib/orders";
import type { PaymentMethodId } from "../../db/schema";

export const prerender = false;

const CheckoutSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().min(3).max(50),
    address: z.string().min(1).max(500),
    postalCode: z.string().min(3).max(20),
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

  try {
    const { order, items } = await createOrder({
      customer: parsed.data.customer,
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
