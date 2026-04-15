import { Resend } from "resend";
import type { Order, OrderItem, OrderStatus } from "../db/schema";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM ?? "Adriana's Store <ola@adrianastore.pt>";
const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.EMAIL_FROM;

export const emailConfigured = Boolean(apiKey);

const resend = apiKey ? new Resend(apiKey) : null;

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
      const personalization = item.personalization
        ? `<div style="font-size:12px;color:#6b7280;margin-top:4px"><em>Personalizado: "${item.personalization.phrase || "—"}" ${item.personalization.description ? `— ${item.personalization.description}` : ""}</em></div>`
        : "";
      return `
        <tr>
          <td style="padding:12px 0;border-top:1px solid #f1e1e9;color:#111">
            <strong>${item.quantity}× ${item.productName}</strong>
            ${personalization}
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
                <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ED7396"><strong>Adriana's Store</strong></p>
                ${inner}
                <p style="margin:32px 0 0 0;font-size:12px;color:#9ca3af">Em caso de dúvida, responde diretamente a este email.</p>
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
}: {
  order: Order;
  items: OrderItem[];
  status: OrderStatus;
}): { subject: string; html: string } => {
  const subject = `${statusSubject[status]} — Encomenda #${order.number}`;

  const tracking = order.trackingCode && status === "shipped"
    ? `<p style="margin:20px 0 0 0;padding:16px;background:#fdf2f8;border-radius:12px;font-size:14px;color:#111">
         Código de tracking CTT: <strong>${order.trackingCode}</strong><br />
         Segue em: <a href="https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${order.trackingCode}" style="color:#ED7396">ctt.pt</a>
       </p>`
    : "";

  const inner = `
    <h1 style="margin:8px 0 16px 0;font-size:24px;color:#111">${statusSubject[status]}</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563">Olá ${order.customerName.split(" ")[0] || ""}, ${statusIntro[status]}</p>
    ${tracking}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr><td style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;padding-bottom:8px"><strong>Resumo da encomenda</strong></td></tr>
      ${renderItems(items)}
      <tr>
        <td style="padding-top:16px;border-top:2px solid #111;color:#111"><strong>Total</strong></td>
        <td style="padding-top:16px;border-top:2px solid #111;text-align:right;color:#111"><strong>${formatEuro(order.subtotalCents)}</strong></td>
      </tr>
    </table>
    <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">Encomenda #${order.number} · ${new Date(order.createdAt).toLocaleDateString("pt-PT")}</p>
  `;

  return { subject, html: baseLayout(subject, inner) };
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

  const { subject, html } = buildOrderEmail(params);

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

export const notifyAdmin = async (params: {
  order: Order;
  items: OrderItem[];
}) => {
  if (!resend || !adminEmail) return;

  const { subject, html } = buildOrderEmail({
    order: params.order,
    items: params.items,
    status: "new",
  });

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject: `[ADMIN] ${subject}`,
      html,
    });
  } catch (err) {
    console.error("[email] Falha a enviar email ao admin:", err);
  }
};
