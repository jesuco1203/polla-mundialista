import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";

export const PARTICIPANT_SESSION_COOKIE = "pm_participant_session";

const PARTICIPANT_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const scrypt = promisify(scryptCallback);

type ParticipantSession = {
  expiresAt: number;
  participantId: string;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-dev-participant-secret");
}

function sign(value: string) {
  const secret = getAuthSecret();
  if (!secret) throw new Error("Falta AUTH_SECRET para firmar sesiones.");

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function timingSafeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function normalizeParticipantPhone(phone: string) {
  return normalizePhone(phone.trim());
}

export async function hashParticipantPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyParticipantPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "base64url");

  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected);
}

export function createParticipantSessionCookie(participantId: string) {
  const payload: ParticipantSession = {
    expiresAt: Date.now() + PARTICIPANT_SESSION_MAX_AGE * 1000,
    participantId,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyParticipantSessionCookie(cookieValue?: string) {
  if (!cookieValue || !getAuthSecret()) return null;

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!timingSafeTextEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as ParticipantSession;
    if (!session.participantId || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getParticipantSession() {
  const cookieStore = await cookies();
  return verifyParticipantSessionCookie(cookieStore.get(PARTICIPANT_SESSION_COOKIE)?.value);
}

export function participantCookieOptions(appUrl?: string) {
  return {
    httpOnly: true,
    maxAge: PARTICIPANT_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax" as const,
    secure: (appUrl ?? process.env.APP_URL ?? "").startsWith("https://"),
  };
}
