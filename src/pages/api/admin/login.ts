import type { APIRoute } from "astro";
import {
  createSessionToken,
  loginUser,
  setSessionCookie,
} from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirect("/admin/login?error=missing");
  }

  const user = await loginUser(email, password);
  if (!user) {
    return redirect("/admin/login?error=invalid");
  }

  const token = await createSessionToken(user);
  setSessionCookie(cookies, token);
  return redirect("/admin");
};
