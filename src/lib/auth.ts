import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { APIContext, AstroCookies } from "astro";
import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "__adm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "editor";
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

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const createSessionToken = async (
  user: SessionUser,
): Promise<string> => {
  return new SignJWT({
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
};

export const verifySessionToken = async (
  token: string,
): Promise<SessionUser | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      name: String(payload.name ?? ""),
      role: payload.role === "admin" ? "admin" : "editor",
    };
  } catch {
    return null;
  }
};

export const setSessionCookie = (cookies: AstroCookies, token: string) => {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = (cookies: AstroCookies) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
};

export const getSessionUser = async (
  cookies: AstroCookies,
): Promise<SessionUser | null> => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
};

export const loginUser = async (
  email: string,
  password: string,
): Promise<SessionUser | null> => {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1);

  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
};

export const requireAuth = async (context: APIContext | { cookies: AstroCookies; redirect: (path: string) => Response }) => {
  const user = await getSessionUser(context.cookies);
  if (!user) {
    throw context.redirect("/admin/login");
  }
  return user;
};

export const requireAdmin = async (context: APIContext | { cookies: AstroCookies; redirect: (path: string) => Response }) => {
  const user = await requireAuth(context);
  if (user.role !== "admin") {
    throw context.redirect("/admin");
  }
  return user;
};
