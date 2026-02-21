/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { PrismaClient, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new (PrismaClient as any)({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@aerender.local" },
    update: {},
    create: {
      email: "admin@aerender.local",
      name: "Administrator",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: UserRole.ADMIN,
    },
  });

  const agent = await prisma.renderAgent.upsert({
    where: { apiKey: "agent-secret-key-change-in-production" },
    update: {},
    create: {
      name: "Local Agent",
      apiKey: "agent-secret-key-change-in-production",
      hostname: "localhost",
      status: "offline",
    },
  });

  console.log("Seed completed:", { admin: admin.email, org: org.slug, agent: agent.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
