import type { APIRoute } from "astro";
import { z } from "zod";
import { db, schema } from "../../../../db/client";
import { hashPassword } from "../../../../lib/auth";

export const prerender = false;

const Schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "editor"]),
});

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user || locals.user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Dados inválidos", issues: parsed.error.format() }),
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      });

    return new Response(JSON.stringify({ success: true, user }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return new Response(
        JSON.stringify({ error: "Já existe um utilizador com este email" }),
        { status: 409 },
      );
    }
    console.error("[users] Falha a criar:", err);
    return new Response(JSON.stringify({ error: "Erro ao criar" }), {
      status: 500,
    });
  }
};
