import { db, schema } from "../db/client";
import { eq, sql as drizzleSql } from "drizzle-orm";
import type { Coupon } from "../db/schema";

export type CouponValidation =
  | {
      ok: true;
      code: string;
      description: string;
      discountCents: number;
      percentOff: number | null;
      amountOffCents: number | null;
    }
  | { ok: false; error: string };

const normalizeCode = (raw: string): string => raw.trim().toUpperCase();

export const computeDiscountCents = (
  coupon: Pick<Coupon, "percentOff" | "amountOffCents">,
  subtotalCents: number,
): number => {
  if (coupon.percentOff != null) {
    const pct = Math.max(0, Math.min(100, coupon.percentOff));
    return Math.min(subtotalCents, Math.round((subtotalCents * pct) / 100));
  }
  if (coupon.amountOffCents != null) {
    return Math.min(subtotalCents, Math.max(0, coupon.amountOffCents));
  }
  return 0;
};

export const findCouponByCode = async (
  code: string,
): Promise<Coupon | null> => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const [row] = await db
    .select()
    .from(schema.coupons)
    .where(drizzleSql`upper(${schema.coupons.code}) = ${normalized}`)
    .limit(1);
  return row ?? null;
};

export const validateCoupon = async (
  rawCode: string,
  subtotalCents: number,
): Promise<CouponValidation> => {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "Insere um código." };
  if (subtotalCents <= 0) {
    return { ok: false, error: "Carrinho vazio." };
  }

  const coupon = await findCouponByCode(code);
  if (!coupon) return { ok: false, error: "Código inválido." };
  if (!coupon.active) return { ok: false, error: "Este cupão já não está ativo." };
  if (coupon.validUntil && coupon.validUntil < new Date()) {
    return { ok: false, error: "Este cupão expirou." };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "Cupão esgotado." };
  }
  if (subtotalCents < coupon.minOrderCents) {
    const min = (coupon.minOrderCents / 100).toFixed(2).replace(".", ",");
    return {
      ok: false,
      error: `Cupão válido apenas a partir de €${min} em compras.`,
    };
  }

  const discountCents = computeDiscountCents(coupon, subtotalCents);
  if (discountCents <= 0) {
    return { ok: false, error: "Cupão sem desconto válido." };
  }

  return {
    ok: true,
    code: coupon.code,
    description: coupon.description,
    discountCents,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
  };
};

export const incrementCouponUsage = async (
  code: string,
  tx?: typeof db,
): Promise<void> => {
  const normalized = normalizeCode(code);
  if (!normalized) return;
  const runner = tx ?? db;
  await runner
    .update(schema.coupons)
    .set({
      usedCount: drizzleSql`${schema.coupons.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(drizzleSql`upper(${schema.coupons.code}) = ${normalized}`);
};

export const formatDiscountLabel = (
  coupon: Pick<Coupon, "percentOff" | "amountOffCents">,
): string => {
  if (coupon.percentOff != null) return `${coupon.percentOff}% de desconto`;
  if (coupon.amountOffCents != null) {
    const v = (coupon.amountOffCents / 100).toFixed(2).replace(".", ",");
    return `€${v} de desconto`;
  }
  return "Sem desconto";
};
