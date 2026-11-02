import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/** Names shown on the login screen (tap your name, then PIN). */
export const listActiveUsers = () =>
  db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
