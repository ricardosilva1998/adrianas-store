import type { APIRoute } from "astro";
import { z } from "zod";
import { transitionOrder, sendTransitionEmail } from "../../../../../lib/orders";

export const prerender = false;

const Schema = z.object({
  to: z.enum(["paid", "preparing", "shipped", "delivered", "cancelled"]),
  trackingCode: z.string().optional(),
  note: z.string().optional(),
});

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    await transitionOrder({
      orderId: id,
      to: parsed.data.to,
      actorUserId: user.id,
      trackingCode: parsed.data.trackingCode ?? null,
      note: parsed.data.note ?? null,
    });

    sendTransitionEmail(id, parsed.data.to).catch((err) =>
      console.error("[orders] Falha a enviar email de transição:", err),
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[orders] Falha na transição:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
};
