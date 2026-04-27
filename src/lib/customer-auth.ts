import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { AstroCookies } from "astro";
import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "__cust_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type CustomerSession = {
  id: number;
  email: string;
  name: string;
};

const getSecret = () => {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "JWT_SECRET em falta (mínimo 16 caracteres). Define a variável de ambiente.",
    );
  }
  return new TextEncoder().encode(raw);
};

export const hashCustomerPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyCustomerPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const createCustomerToken = async (
  customer: CustomerSession,
): Promise<string> => {
  return new SignJWT({
    sub: String(customer.id),
    email: customer.email,
    name: customer.name,
    kind: "customer",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
};

export const verifyCustomerToken = async (
  token: string,
): Promise<CustomerSession | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "customer") return null;
    if (!payload.sub || !payload.email) return null;
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
};

export const setCustomerCookie = (cookies: AstroCookies, token: string) => {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearCustomerCookie = (cookies: AstroCookies) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
};

export const getCustomerSession = async (
  cookies: AstroCookies,
): Promise<CustomerSession | null> => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyCustomerToken(token);
};

export const loginCustomer = async (
  email: string,
  password: string,
): Promise<CustomerSession | null> => {
  const [row] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.email, email.toLowerCase()))
    .limit(1);
  if (!row) return null;
  const ok = await verifyCustomerPassword(password, row.passwordHash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
};
