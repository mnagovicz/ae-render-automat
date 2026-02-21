import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalJobs,
    completedJobs,
    failedJobs,
    pendingJobs,
    activeAgents,
    totalTemplates,
  ] = await Promise.all([
    prisma.renderJob.count(),
    prisma.renderJob.count({ where: { status: "COMPLETED" } }),
    prisma.renderJob.count({ where: { status: "FAILED" } }),
    prisma.renderJob.count({ where: { status: "PENDING" } }),
    prisma.renderAgent.count({ where: { status: { in: ["online", "busy"] } } }),
    prisma.template.count({ where: { isActive: true } }),
  ]);

  return NextResponse.json({
    totalJobs,
    completedJobs,
    failedJobs,
    pendingJobs,
    activeAgents,
    totalTemplates,
  });
}
