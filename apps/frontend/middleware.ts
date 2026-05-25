import { NextRequest, NextResponse } from "next/server";

const sessionHintCookie = "crm_session_hint";
const publicPaths = ["/health", "/login"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasSessionHint = request.cookies.get(sessionHintCookie)?.value === "1";

  if (!publicPaths.includes(pathname) && !hasSessionHint) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
