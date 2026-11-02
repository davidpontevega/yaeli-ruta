import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth-cookie";

// Optimistic check (cookie exists). The real DB check is `requireUser` in src/server/auth.ts.
export default function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
