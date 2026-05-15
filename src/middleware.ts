import { defineMiddleware } from "astro:middleware";
import { getSessionUser } from "./lib/auth";
import { getCustomerSession } from "./lib/customer-auth";
import { getPreview, getPagePreview } from "./lib/preview-store";
import { shouldTrack, getClientIp, recordPageView } from "./lib/tracking";

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

  // Populate customer session on every storefront/API route (non-admin).
  const customer = await getCustomerSession(context.cookies);
  if (customer) context.locals.customer = customer;

  // Populate admin user on storefront routes when drafting or previewing.
  const wantsAdminContext =
    context.url.searchParams.has("preview") ||
    context.url.searchParams.get("draft") === "1";
  if (wantsAdminContext) {
    const user = await getSessionUser(context.cookies);
    if (user) context.locals.user = user;
  }

  // Storefront preview: only effective for authenticated admins.
  const previewToken = context.url.searchParams.get("preview");
  if (previewToken) {
    const user = context.locals.user ?? (await getSessionUser(context.cookies));
    if (user) {
      const pendingConfig = getPreview(previewToken);
      if (pendingConfig) {
        context.locals.previewConfig = pendingConfig;
      }
      const pendingPage = getPagePreview(previewToken);
      if (pendingPage) {
        context.locals.pagePreview = pendingPage;
      }
    }
  }

  // Tracking de visitas (storefront only — branch admin já saiu acima).
  if (shouldTrack(context.request, context.url)) {
    void recordPageView({
      path: context.url.pathname,
      ip: getClientIp(context.request.headers),
      ua: context.request.headers.get("user-agent") ?? "",
    }).catch((err) => console.warn("[track]", err));
  }

  return next();
});
