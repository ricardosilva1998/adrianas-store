import { defineMiddleware } from "astro:middleware";
import { getSessionUser } from "./lib/auth";
import { getPreview } from "./lib/preview-store";

const PUBLIC_ADMIN_ROUTES = new Set(["/admin/login", "/api/admin/login"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Admin auth gate (unchanged).
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (PUBLIC_ADMIN_ROUTES.has(path)) {
      return next();
    }
    const user = await getSessionUser(context.cookies);
    if (!user) {
      if (path.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/admin/login");
    }
    context.locals.user = user;
    return next();
  }

  // Storefront preview: only effective for authenticated admins.
  const previewToken = context.url.searchParams.get("preview");
  if (previewToken) {
    const user = await getSessionUser(context.cookies);
    if (user) {
      const pending = getPreview(previewToken);
      if (pending) {
        context.locals.previewConfig = pending;
      }
    }
  }

  return next();
});
