import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.renderJob.findUnique({
    where: { id },
    include: {
      template: {
        include: { variables: true, footageSlots: true },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      agent: { select: { id: true, name: true, hostname: true } },
      jobData: true,
      jobAssets: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.user.role === "CLIENT" && job.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const job = await prisma.renderJob.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(job);
}
