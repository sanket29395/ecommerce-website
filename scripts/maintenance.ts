import { db } from "../src/lib/db";
async function main() {
  const now = new Date();
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.passwordToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.rateLimit.deleteMany({
    where: { resetAt: { lt: new Date(Date.now() - 86400000) } },
  });
  console.log(
    "Expired authentication records removed. Order reservations were not changed.",
  );
}
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
