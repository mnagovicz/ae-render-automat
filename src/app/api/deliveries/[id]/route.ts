import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const destination = await prisma.deliveryDestination.findUnique({
    where: { id },
    include: {
      templates: {
        include: { template: { select: { id: true, name: true } } },
      },
    },
  });

  if (!destination) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(destination);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["FTP", "SFTP", "WEBHOOK"]).optional(),
  host: z.string().nullable().optional(),
  port: z.number().nullable().optional(),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  webhookUrl: z.string().nullable().optional(),
  webhookHeaders: z.record(z.string(), z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const destination = await prisma.deliveryDestination.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(destination);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const destination = await prisma.deliveryDestination.findUnique({
    where: { id },
    include: { _count: { select: { templates: true, renderJobs: true } } },
  });

  if (!destination) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.deliveryDestination.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
