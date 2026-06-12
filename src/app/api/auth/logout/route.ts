import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_SESSION_COOKIE, getAppUrl } from "@/lib/google-auth";
import { PARTICIPANT_SESSION_COOKIE } from "@/lib/participant-auth";

export async function POST(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.delete(GOOGLE_SESSION_COOKIE);
  response.cookies.delete(PARTICIPANT_SESSION_COOKIE);

  return response;
}
