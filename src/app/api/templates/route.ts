import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  organizationId: z.string().min(1),
  exportCompName: z.string().optional(),
  controlCompName: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOperator = session.user.role === "OPERATOR";

  let templates;
  if (isAdmin || isOperator) {
    templates = await prisma.template.findMany({
      include: {
        organization: true,
        _count: { select: { variables: true, footageSlots: true, renderJobs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    templates = await prisma.template.findMany({
      where: { organizationId: { in: orgIds }, isActive: true },
      include: {
        organization: true,
        _count: { select: { variables: true, footageSlots: true, renderJobs: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      organizationId: parsed.data.organizationId,
      exportCompName: parsed.data.exportCompName || "___Fotbal_Chance_export",
      controlCompName: parsed.data.controlCompName,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
