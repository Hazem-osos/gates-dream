import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Primary (writes)
export const prismaWrite = new PrismaClient();

// Optional read-replica (set REPLICA_DATABASE_URL)
export const prismaRead = process.env.REPLICA_DATABASE_URL
  ? new PrismaClient({
      datasources: { db: { url: process.env.REPLICA_DATABASE_URL } },
    })
  : prismaWrite;


