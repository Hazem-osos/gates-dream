/**
 * Rich demo business data for hazem@gmail.com
 * Run: npm run seed:hazem
 * Re-run transactions: FORCE_TRANSACTIONS=1 npm run seed:hazem
 */
import { PrismaClient } from '@prisma/client';
import { hazemDemoSeedService } from '../src/modules/demo/hazem-demo-seed.service.js';

const prisma = new PrismaClient();

async function main() {
  const forceTransactions = process.env.FORCE_TRANSACTIONS === '1';
  const result = await hazemDemoSeedService.seed({ forceTransactions });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
