import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  createGoogleState,
  getAppUrl,
  googleCookieOptions,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(new URL("/?authError=missing_config#registro", appUrl));
  }

  const state = createGoogleState();
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    ...googleCookieOptions(appUrl),
    maxAge: 60 * 10,
  });

  return response;
}
