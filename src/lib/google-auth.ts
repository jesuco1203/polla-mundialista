import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const GOOGLE_SESSION_COOKIE = "pm_google_session";
export const GOOGLE_STATE_COOKIE = "pm_google_state";

const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export type GoogleSession = {
  email: string;
  expiresAt: number;
  name: string;
  picture?: string;
  sub: string;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && getAuthSecret());
}

export function getAppUrl(request?: NextRequest) {
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return request?.nextUrl.origin ?? "http://localhost:3000";
}

function sign(value: string) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("Falta AUTH_SECRET para firmar sesiones.");

  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createGoogleState() {
  return randomBytes(24).toString("base64url");
}

export function createGoogleSessionCookie(session: Omit<GoogleSession, "expiresAt">) {
  const payload: GoogleSession = {
    ...session,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyGoogleSessionCookie(cookieValue?: string) {
  if (!cookieValue) return null;

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GoogleSession;
    if (!session.email || !session.sub || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getGoogleSession() {
  if (!getAuthSecret()) return null;

  const cookieStore = await cookies();
  return verifyGoogleSessionCookie(cookieStore.get(GOOGLE_SESSION_COOKIE)?.value);
}

export function googleCookieOptions(appUrl: string) {
  return {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: appUrl.startsWith("https://"),
  };
}
