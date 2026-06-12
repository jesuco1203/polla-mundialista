import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "pm_admin_session";

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSession = {
  expiresAt: number;
  role: "admin";
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function sign(value: string) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("Falta AUTH_SECRET para firmar la sesion admin.");

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminPin(pin: string) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) throw new Error("Falta configurar ADMIN_PIN en el servidor.");
  return timingSafeTextEqual(pin, expected);
}

export function createAdminSessionCookie() {
  const payload: AdminSession = {
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
    role: "admin",
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAdminSessionCookie(cookieValue?: string) {
  if (!cookieValue || !getAuthSecret()) return false;

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = sign(encodedPayload);
  if (!timingSafeTextEqual(signature, expectedSignature)) return false;

  try {
    const session = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSession;
    return session.role === "admin" && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export function adminCookieOptions(appUrl?: string) {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/admin",
    sameSite: "lax" as const,
    secure: (appUrl ?? process.env.APP_URL ?? "").startsWith("https://"),
  };
}
