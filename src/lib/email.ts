import { Resend } from "resend";
import type { Order, OrderItem, OrderStatus } from "../db/schema";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM ?? "Drisclub <no-reply@drisclub.com>";
const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.EMAIL_FROM;

export const emailConfigured = Boolean(apiKey);

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Resolve the list of admin recipients for order alerts. site_config.globals
 * .notifyEmails takes precedence; if empty, fall back to the env var.
 */
const resolveAdminRecipients = async (): Promise<string[]> => {
  try {
    const { getSiteConfig } = await import("./config-server");
    const cfg = await getSiteConfig();
    const list = Array.isArray(cfg.globals.notifyEmails) ? cfg.globals.notifyEmails : [];
    const cleaned = list
      .map((e) => (typeof e === "string" ? e.trim() : ""))
      .filter((e) => e.length > 0);
    if (cleaned.length > 0) return cleaned;
  } catch (err) {
    console.error("[email] Falha ao ler notifyEmails do site_config:", err);
  }
  return adminEmail ? [adminEmail] : [];
};

export type EmailStatus = {
  configured: boolean;
  hasResendKey: boolean;
  from: string | null;
  adminTo: string | null;
  issues: string[];
};

export const getEmailStatus = (): EmailStatus => {
  const hasResendKey = Boolean(process.env.RESEND_API_KEY);
  const hasFrom = Boolean(process.env.EMAIL_FROM);
  const hasAdmin = Boolean(process.env.ADMIN_NOTIFY_EMAIL);

  const issues: string[] = [];
  if (!hasResendKey) issues.push("Falta RESEND_API_KEY");
  if (!hasFrom) issues.push("Falta EMAIL_FROM (remetente verificado no Resend)");
  if (!hasAdmin) issues.push("Falta ADMIN_NOTIFY_EMAIL (destinatário do alerta de vendas)");

  return {
    configured: hasResendKey && hasFrom && hasAdmin,
    hasResendKey,
    from: process.env.EMAIL_FROM ?? null,
    adminTo: process.env.ADMIN_NOTIFY_EMAIL ?? null,
    issues,
  };
};

const formatEuro = (cents: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const statusSubject: Record<OrderStatus, string> = {
  new: "Recebemos a tua encomenda",
  paid: "Pagamento confirmado",
  preparing: "Estamos a preparar a tua encomenda",
  shipped: "A tua encomenda está a caminho",
  delivered: "Entrega concluída",
  cancelled: "A tua encomenda foi cancelada",
};

const statusIntro: Record<OrderStatus, string> = {
  new: "Obrigado pela tua encomenda! Assim que confirmarmos o pagamento, começamos a produção.",
  paid: "Recebemos o pagamento. A tua encomenda entra agora em fila de preparação.",
  preparing: "Estamos a trabalhar nas tuas peças à mão. Em breve segue para envio.",
  shipped: "Encomenda enviada via CTT. Podes acompanhar com o código abaixo.",
  delivered: "A encomenda foi entregue. Esperamos que gostes! Se tiveres um momento, adoramos ver uma fotografia no Instagram 💌",
  cancelled: "A tua encomenda foi cancelada. Se tiveres dúvidas, responde a este email.",
};

const renderItems = (items: OrderItem[]): string => {
  return items
    .map((item) => {
      const p = item.personalization;
      const hasVariant = p && p.variantColor;
      const hasPersonalization = p && (p.phrase || p.description || (p.colors && p.colors.length > 0));
      const variantLine = hasVariant
        ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Cor: <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${p.variantColor!.hex};border:1px solid #e5e7eb;vertical-align:middle"></span> ${p.variantColor!.name}</div>`
        : "";
      const personalizationLine = hasPersonalization
        ? `<div style="font-size:12px;color:#6b7280;margin-top:4px"><em>Personalizado: "${p!.phrase || "—"}" ${p!.description ? `— ${p!.description}` : ""}</em></div>`
        : "";
      const attachmentLine = p?.attachment
        ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">Ficheiro: <a href="${p.attachment.url}" style="color:#ED7396;text-decoration:underline">${p.attachment.name}</a> (${p.attachment.kind.toUpperCase()})</div>`
        : "";
      return `
        <tr>
          <td style="padding:12px 0;border-top:1px solid #f1e1e9;color:#111">
            <strong>${item.quantity}× ${item.productName}</strong>
            ${variantLine}
            ${personalizationLine}
            ${attachmentLine}
          </td>
          <td style="padding:12px 0;border-top:1px solid #f1e1e9;text-align:right;color:#111">
            ${formatEuro(item.unitPriceCents * item.quantity)}
          </td>
        </tr>`;
    })
    .join("");
};

const baseLayout = (title: string, inner: string) => `
<!DOCTYPE html>
<html lang="pt-PT">
  <head><meta charset="UTF-8"><title>${title}</title></head>
  <body style="margin:0;padding:0;background:#fdf2f8;font-family:Inter,system-ui,sans-serif;color:#111">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf2f8;padding:32px 0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;padding:40px;border:1px solid #fbcfe8">
            <tr>
              <td>
                <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ED7396"><strong>Drisclub</strong></p>
                ${inner}
                <p style="margin:32px 0 0 0;font-size:12px;color:#9ca3af">Em caso de dúvida, responde diretamente a este email ou envie e-mail para <a href="mailto:drisclub.shop@gmail.com" style="color:#ED7396">drisclub.shop@gmail.com</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const buildOrderEmail = ({
  order,
  items,
  status,
  paymentInstructions,
}: {
  order: Order;
  items: OrderItem[];
  status: OrderStatus;
  /** Pre-formatted HTML for the chosen payment method's instructions. */
  paymentInstructions?: string;
}): { subject: string; html: string } => {
  const subject = `${statusSubject[status]} — Encomenda #${order.number}`;

  const tracking = order.trackingCode && status === "shipped"
    ? `<p style="margin:20px 0 0 0;padding:16px;background:#fdf2f8;border-radius:12px;font-size:14px;color:#111">
         Código de tracking CTT: <strong>${order.trackingCode}</strong><br />
         Segue em: <a href="https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${order.trackingCode}" style="color:#ED7396">ctt.pt</a>
       </p>`
    : "";

  const subtotalCents = order.subtotalCents;
  const discountCents = order.discountCents ?? 0;
  const shippingCents = order.shippingCents ?? 0;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  const discountRow = discountCents > 0
    ? `<tr>
         <td style="padding-top:6px;color:#6b7280;font-size:13px">Desconto${order.couponCode ? ` (${order.couponCode})` : ""}</td>
         <td style="padding-top:6px;text-align:right;color:#059669;font-size:13px">−${formatEuro(discountCents)}</td>
       </tr>`
    : "";

  const shippingLabel = order.shippingMethodLabel ?? "Envio";
  const shippingValue =
    shippingCents === 0
      ? `<span style="color:#059669">Grátis</span>`
      : formatEuro(shippingCents);
  const shippingRow = `
    <tr>
      <td style="padding-top:6px;color:#6b7280;font-size:13px">${shippingLabel}</td>
      <td style="padding-top:6px;text-align:right;color:#111;font-size:13px">${shippingValue}</td>
    </tr>
    ${
      order.shippingMethodDescription
        ? `<tr><td colspan="2" style="padding-top:2px;color:#9ca3af;font-size:12px;font-style:italic">${order.shippingMethodDescription}</td></tr>`
        : ""
    }`;

  const paymentBlock = paymentInstructions
    ? `<div style="margin-top:24px;padding:16px;background:#fdf2f8;border-radius:12px;font-size:13px;color:#111;line-height:1.6">
         <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af"><strong>Como pagar</strong></p>
         ${paymentInstructions}
       </div>`
    : "";

  const inner = `
    <h1 style="margin:8px 0 16px 0;font-size:24px;color:#111">${statusSubject[status]}</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">Olá ${order.customerName.split(" ")[0] || ""}, ${statusIntro[status]}</p>
    ${tracking}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;padding-bottom:8px" colspan="2"><strong>Resumo da encomenda</strong></td></tr>
      ${renderItems(items)}
      <tr>
        <td style="padding-top:14px;color:#6b7280;font-size:13px;border-top:1px solid #fbcfe8">Subtotal</td>
        <td style="padding-top:14px;text-align:right;color:#111;font-size:13px;border-top:1px solid #fbcfe8">${formatEuro(subtotalCents)}</td>
      </tr>
      ${discountRow}
      ${shippingRow}
      <tr>
        <td style="padding-top:14px;border-top:2px solid #111;color:#111"><strong>Total</strong></td>
        <td style="padding-top:14px;border-top:2px solid #111;text-align:right;color:#111"><strong>${formatEuro(totalCents)}</strong></td>
      </tr>
    </table>
    ${paymentBlock}
    <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">Encomenda #${order.number} · ${new Date(order.createdAt).toLocaleDateString("pt-PT")}</p>
  `;

  return { subject, html: baseLayout(subject, inner) };
};

/**
 * Plain-text payment instructions → safe HTML (escape + line-breaks).
 * Used to embed the chosen method's procedures inside the confirmation email.
 */
const renderPaymentInstructions = (raw: string): string => {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br />");
};

const loadPaymentInstructions = async (
  method: string,
): Promise<string | undefined> => {
  try {
    const { getSiteConfig } = await import("./config-server");
    const config = await getSiteConfig();
    const entry = config.globals.payments.find((p) => p.id === method);
    if (!entry) return undefined;
    const heading = `<strong>${entry.label}</strong>`;
    return `${heading}<br />${renderPaymentInstructions(entry.instructions)}`;
  } catch (err) {
    console.error("[email] Falha a carregar instruções de pagamento:", err);
    return undefined;
  }
};

export const sendOrderEmail = async (params: {
  order: Order;
  items: OrderItem[];
  status: OrderStatus;
}) => {
  if (!resend) {
    console.warn(
      `[email] Resend não configurado — skip email para encomenda #${params.order.number} (${params.status})`,
    );
    return;
  }

  // Payment instructions are only useful while the customer still has to pay
  // — show them on the initial confirmation, not on later transitions.
  const paymentInstructions =
    params.status === "new"
      ? await loadPaymentInstructions(params.order.paymentMethod)
      : undefined;
  const { subject, html } = buildOrderEmail({ ...params, paymentInstructions });

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [params.order.customerEmail],
      subject,
      html,
      replyTo: adminEmail ? [adminEmail] : undefined,
    });
  } catch (err) {
    console.error("[email] Falha a enviar email para cliente:", err);
  }
};

export const sendWelcomeEmail = async (params: {
  name: string;
  email: string;
}) => {
  if (!resend) {
    console.warn(
      `[email] Resend não configurado — skip welcome email para ${params.email}`,
    );
    return;
  }

  const firstName = params.name.trim().split(/\s+/)[0] || "";
  const subject = "Bem-vindo(a) ao Drisclub 💌";
  const inner = `
    <h1 style="margin:8px 0 16px 0;font-size:24px;color:#111">Agora já fazes parte do clube ✨</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">
      Olá ${firstName}, obrigada por criares conta na Drisclub!
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">
      Cada peça é feita à mão no nosso atelier, personalizada para ti.
      Aproveita para explorar a coleção e descobrir as novidades.
    </p>
    <p style="margin:24px 0 0 0">
      <a href="https://drisclub.com/catalogo" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#ED7396;color:#fff;text-decoration:none;font-weight:600;font-size:14px">
        Ver coleção
      </a>
    </p>
  `;
  try {
    await resend.emails.send({
      from: fromEmail,
      to: [params.email],
      subject,
      html: baseLayout(subject, inner),
      replyTo: adminEmail ? [adminEmail] : undefined,
    });
  } catch (err) {
    console.error("[email] Falha a enviar welcome email:", err);
  }
};

export const sendPasswordResetEmail = async (params: {
  name: string;
  email: string;
  resetUrl: string;
}) => {
  if (!resend) {
    console.warn(
      `[email] Resend não configurado — skip password-reset email para ${params.email}`,
    );
    return;
  }

  const firstName = params.name.trim().split(/\s+/)[0] || "";
  const subject = "Repor palavra-passe — Drisclub";
  const inner = `
    <h1 style="margin:8px 0 16px 0;font-size:24px;color:#111">Repor palavra-passe</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">
      Olá ${firstName}, recebemos um pedido para repor a palavra-passe da tua conta.
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">
      Clica no botão abaixo para escolher uma nova palavra-passe. O link é válido durante <strong>1 hora</strong>.
    </p>
    <p style="margin:24px 0 0 0">
      <a href="${params.resetUrl}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#ED7396;color:#fff;text-decoration:none;font-weight:600;font-size:14px">
        Definir nova palavra-passe
      </a>
    </p>
    <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#9ca3af">
      Se não pediste a reposição, podes ignorar este email — a tua palavra-passe atual continua válida.
    </p>
    <p style="margin:12px 0 0 0;font-size:11px;line-height:1.5;color:#9ca3af;word-break:break-all">
      Se o botão não funcionar, copia este link:<br />${params.resetUrl}
    </p>
  `;
  try {
    await resend.emails.send({
      from: fromEmail,
      to: [params.email],
      subject,
      html: baseLayout(subject, inner),
      replyTo: adminEmail ? [adminEmail] : undefined,
    });
  } catch (err) {
    console.error("[email] Falha a enviar password-reset email:", err);
  }
};

export const notifyAdmin = async (params: {
  order: Order;
  items: OrderItem[];
}) => {
  if (!resend) return;
  const recipients = await resolveAdminRecipients();
  if (recipients.length === 0) return;

  const paymentInstructions = await loadPaymentInstructions(params.order.paymentMethod);
  const { subject, html } = buildOrderEmail({
    order: params.order,
    items: params.items,
    status: "new",
    paymentInstructions,
  });

  try {
    await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: `[ADMIN] ${subject}`,
      html,
    });
  } catch (err) {
    console.error("[email] Falha a enviar email ao admin:", err);
  }
};
