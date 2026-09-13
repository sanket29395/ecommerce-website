import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { sessionSecret } from "./env";
import { token } from "./crypto";
import { HttpError } from "./http";
export function digest(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}
export async function currentUser() {
  const raw = (await cookies()).get("session")?.value;
  if (!raw) return null;
  const session = await db.session.findUnique({
    where: { id: digest(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required");
  return user;
}
export async function newSession(userId: string) {
  const jar = await cookies();
  const old = jar.get("session")?.value;
  if (old) await db.session.deleteMany({ where: { id: digest(old) } });
  const raw = token();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.session.create({ data: { id: digest(raw), userId, expiresAt } });
  jar.set("session", raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function logout() {
  const jar = await cookies();
  const raw = jar.get("session")?.value;
  if (raw) await db.session.deleteMany({ where: { id: digest(raw) } });
  jar.delete("session");
}
export async function limit(key: string, max: number, seconds: number) {
  const now = new Date();
  const resetAt = new Date(Date.now() + seconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
 INSERT INTO "RateLimit" ("key","count","resetAt") VALUES (${digest(key)},1,${resetAt})
 ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."resetAt"<${now} THEN 1 ELSE "RateLimit"."count"+1 END,
 "resetAt"=CASE WHEN "RateLimit"."resetAt"<${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  if (rows[0].count > max)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export function clientIp(req: Request) {
  const h = process.env.TRUSTED_IP_HEADER;
  return h ? req.headers.get(h)?.split(",")[0]?.trim() || "unknown" : "global";
}
