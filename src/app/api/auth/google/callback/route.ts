import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/audit-log";
import {
  GOOGLE_REFERRAL_COOKIE,
  GOOGLE_SESSION_COOKIE,
  GOOGLE_STATE_COOKIE,
  createGoogleSessionCookie,
  getAppUrl,
  googleCookieOptions,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";
import { REFERRAL_INVITE_LIMIT } from "@/lib/referral-bonus";
import { makeAccessCode } from "@/lib/scoring";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
};

async function makeUniqueParticipantCode(field: "accessCode" | "referralCode") {
  let code = makeAccessCode();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exists = await prisma.participant.findFirst({
      where: { [field]: code },
      select: { id: true },
    });
    if (!exists) return code;
    code = makeAccessCode();
  }

  throw new Error("No se pudo generar un codigo unico.");
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const homeUrl = new URL("/#registro", appUrl);

  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(new URL("/?authError=missing_config#registro", appUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?authError=invalid_state#registro", appUrl));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/auth/google/callback`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenJson.access_token) {
    return NextResponse.redirect(new URL("/?authError=google_token#registro", appUrl));
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const user = (await userResponse.json()) as GoogleUserInfo;
  if (!userResponse.ok || !user.email || !user.sub || user.email_verified === false) {
    return NextResponse.redirect(new URL("/?authError=google_profile#registro", appUrl));
  }

  const email = user.email.toLowerCase();
  const referralCode = request.cookies.get(GOOGLE_REFERRAL_COOKIE)?.value?.trim().toUpperCase();
  const existingParticipant = await prisma.participant.findFirst({
    where: { email },
    select: { id: true },
  });

  if (!existingParticipant) {
    const referrer = referralCode
      ? await prisma.participant.findUnique({
          where: { referralCode },
          select: {
            id: true,
            _count: {
              select: { referrals: true },
            },
          },
        })
      : null;
    const canUseReferral = referrer && referrer._count.referrals < REFERRAL_INVITE_LIMIT;
    const [accessCode, participantReferralCode] = await Promise.all([
      makeUniqueParticipantCode("accessCode"),
      makeUniqueParticipantCode("referralCode"),
    ]);
    const participant = await prisma.participant.create({
      data: {
        accessCode,
        email,
        name: user.name ?? email,
        phone: "Google",
        referralCode: participantReferralCode,
        referredById: canUseReferral ? referrer.id : null,
      },
      select: {
        accessCode: true,
        id: true,
        name: true,
        referralCode: true,
        referredById: true,
      },
    });

    await logEvent({
      actor: email,
      event: "participant.google_registered",
      payload: {
        accessCode: participant.accessCode,
        name: participant.name,
        referralCode: participant.referralCode,
        referredById: participant.referredById,
        usedReferralCode: canUseReferral ? referralCode : null,
      },
      targetId: participant.id,
      targetType: "Participant",
    });
  }

  await logEvent({
    actor: email,
    event: "auth.google_login",
    payload: {
      name: user.name ?? email,
      provider: "google",
    },
    targetId: user.sub,
    targetType: "AuthSession",
  });

  const response = NextResponse.redirect(homeUrl);
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  response.cookies.delete(GOOGLE_REFERRAL_COOKIE);
  response.cookies.set(
    GOOGLE_SESSION_COOKIE,
    createGoogleSessionCookie({
      email,
      name: user.name ?? email,
      picture: user.picture,
      sub: user.sub,
    }),
    googleCookieOptions(appUrl),
  );

  return response;
}
