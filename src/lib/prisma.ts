/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: any };

function createPrismaClient() {
  // RDS requires SSL - use rejectUnauthorized: false for self-signed RDS certificate
  const ssl = process.env.DATABASE_URL?.includes("rds.amazonaws.com") 
    ? { rejectUnauthorized: false }
    : undefined;
  const adapter = new PrismaPg({ 
    connectionString: process.env.DATABASE_URL!,
    ssl,
  });
  return new (PrismaClient as any)({ adapter });
}

export const prisma: any = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
