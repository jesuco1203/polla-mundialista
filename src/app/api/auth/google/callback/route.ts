import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/audit-log";
import {
  GOOGLE_SESSION_COOKIE,
  GOOGLE_STATE_COOKIE,
  createGoogleSessionCookie,
  getAppUrl,
  googleCookieOptions,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

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

  await logEvent({
    actor: user.email,
    event: "auth.google_login",
    payload: {
      name: user.name ?? user.email,
      provider: "google",
    },
    targetId: user.sub,
    targetType: "AuthSession",
  });

  const response = NextResponse.redirect(homeUrl);
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  response.cookies.set(
    GOOGLE_SESSION_COOKIE,
    createGoogleSessionCookie({
      email: user.email,
      name: user.name ?? user.email,
      picture: user.picture,
      sub: user.sub,
    }),
    googleCookieOptions(appUrl),
  );

  return response;
}
