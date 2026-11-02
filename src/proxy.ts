import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/server/auth-cookie";

// Chequeo optimista (solo existencia de cookie). La validación real contra la BD está en `requerirUsuario`.
export default function proxy(req: NextRequest) {
  if (!req.cookies.has(COOKIE_SESION)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
