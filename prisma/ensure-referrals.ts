import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
  return rows.some((row) => row.name === column);
}

async function main() {
  if (!(await columnExists("Participant", "referralCode"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Participant" ADD COLUMN "referralCode" TEXT`);
  }

  if (!(await columnExists("Participant", "referredById"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Participant" ADD COLUMN "referredById" TEXT`);
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Participant" SET "referralCode" = "accessCode" WHERE "referralCode" IS NULL OR "referralCode" = ''`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Participant_referralCode_key" ON "Participant"("referralCode")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Participant_referredById_idx" ON "Participant"("referredById")`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
