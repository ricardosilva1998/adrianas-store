import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db/client";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user || locals.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
  }

  if (id === locals.user.id) {
    return new Response(
      JSON.stringify({ error: "Não podes apagar a tua própria conta" }),
      { status: 400 },
    );
  }

  try {
    await db.delete(schema.users).where(eq(schema.users.id, id));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("[users] Falha a apagar:", err);
    return new Response(JSON.stringify({ error: "Erro ao apagar" }), {
      status: 500,
    });
  }
};
