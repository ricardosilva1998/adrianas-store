import type { APIRoute } from "astro";
import { clearCustomerCookie } from "../../../lib/customer-auth";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  clearCustomerCookie(cookies);
  return redirect("/conta");
};
