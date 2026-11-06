import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth-cookie";

// Optimistic check (cookie exists). The real DB check is `requireUser` in src/server/auth.ts.
export default function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) {
    // API clients (fetch, offline sync) need a status, not the login page.
    if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesión vencida; vuelve a entrar" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
