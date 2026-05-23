import { NextRequest, NextResponse } from "next/server";

const sessionHintCookie = "crm_session_hint";
const publicPaths = ["/health", "/login"];

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0];
  const pathname = request.nextUrl.pathname;
  const adminHost = getUrlHost(process.env.NEXT_PUBLIC_ADMIN_URL) ?? process.env.ADMIN_DOMAIN;
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const crmHost = getUrlHost(process.env.NEXT_PUBLIC_CRM_URL) ?? process.env.CRM_DOMAIN;
  const hasSessionHint = request.cookies.get(sessionHintCookie)?.value === "1";
  const effectivePathname = adminHost && host === adminHost && pathname === "/" ? "/admin" : pathname;

  if (crmHost && adminHost && adminUrl && host === crmHost && pathname.startsWith("/admin")) {
    const url = new URL(adminUrl);
    url.pathname = pathname;
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (!publicPaths.includes(pathname) && !hasSessionHint) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", effectivePathname);
    return NextResponse.redirect(url);
  }

  if (adminHost && host === adminHost && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

function getUrlHost(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).host.split(":")[0];
  } catch {
    return undefined;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
