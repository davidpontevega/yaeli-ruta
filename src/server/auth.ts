import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, users, type Role } from "./db/schema";
import { PATH_HEADER, SESSION_COOKIE } from "./auth-cookie";
import { canSee, firstAllowed } from "@/lib/menus";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type CurrentUser = { id: string; name: string; role: Role; isAdmin: boolean; hiddenMenus: string[] };

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  const device = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), device, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Session user, or null. Checks in DB that the session is still valid and the user active. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, name: users.name, role: users.role, isAdmin: users.isAdmin, hiddenMenus: users.hiddenMenus })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return row ?? null;
});

/**
 * For pages and server actions: redirects to login without a session, home without the role,
 * and to the first visible screen when the requested one is hidden for this user (spec 020).
 */
export async function requireUser(...roles: Role[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect("/");
  const path = (await headers()).get(PATH_HEADER);
  if (path && !canSee(path, u.role, u.hiddenMenus)) {
    const to = firstAllowed(u.role, u.hiddenMenus);
    // Nothing visible (only after a role change): "/login" would bounce back to "/", so let the page through.
    if (to !== "/login") redirect(to);
  }
  return u;
}

/** Admin-only screens (/menus): anyone else goes home. */
export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser("DUENO");
  if (!u.isAdmin) redirect("/");
  return u;
}
