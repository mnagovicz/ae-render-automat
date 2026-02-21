import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.renderJob.findUnique({ where: { id } });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["FAILED", "PENDING"].includes(job.status)) {
    return NextResponse.json(
      { error: "Can only take over FAILED or PENDING jobs" },
      { status: 400 }
    );
  }

  const updated = await prisma.renderJob.update({
    where: { id },
    data: {
      status: "MANUAL",
      agentId: null,
    },
  });

  return NextResponse.json(updated);
}
