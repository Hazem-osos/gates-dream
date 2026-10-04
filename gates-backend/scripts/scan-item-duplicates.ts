import { PrismaClient } from '@prisma/client';
import { env } from '../src/shared/config/env';

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const serials = await prisma.$queryRawUnsafe<Array<{ groupCount: unknown }>>(
    `SELECT COUNT(*) AS groupCount FROM (SELECT companyId, serial FROM items WHERE serial IS NOT NULL AND serial <> '' GROUP BY companyId, serial HAVING COUNT(*) > 1) d`
  );
  const barcodes = await prisma.$queryRawUnsafe<Array<{ groupCount: unknown }>>(
    `SELECT COUNT(*) AS groupCount FROM (SELECT companyId, barcode FROM items WHERE barcode IS NOT NULL AND barcode <> '' GROUP BY companyId, barcode HAVING COUNT(*) > 1) d`
  );
  console.log(
    JSON.stringify({
      duplicateSerialGroups: Number(serials[0]?.groupCount ?? 0),
      duplicateBarcodeGroups: Number(barcodes[0]?.groupCount ?? 0),
    })
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'scan failed');
  process.exit(1);
});
