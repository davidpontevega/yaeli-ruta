import "server-only";
import { and, asc, count, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";

/** All users with how many unexpired sessions (phones) each one has. */
export const listUsersWithSessions = (now: Date) =>
  db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      active: users.active,
      lockedUntil: users.lockedUntil,
      sessions: count(sessions.id),
    })
    .from(users)
    .leftJoin(sessions, and(eq(sessions.userId, users.id), gt(sessions.expiresAt, now)))
    .groupBy(users.id)
    .orderBy(asc(users.name));

export type UserRow = Awaited<ReturnType<typeof listUsersWithSessions>>[number];
