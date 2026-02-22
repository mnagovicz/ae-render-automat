import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deliveries = await prisma.templateDelivery.findMany({
    where: { templateId: id },
    include: {
      deliveryDestination: {
        select: { id: true, name: true, type: true, isActive: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(deliveries);
}

const saveSchema = z.object({
  deliveries: z.array(
    z.object({
      deliveryDestinationId: z.string().min(1),
      clientVisible: z.boolean().default(false),
      clientLabel: z.string().optional(),
      sortOrder: z.number().default(0),
    })
  ),
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
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.templateDelivery.deleteMany({ where: { templateId: id } });

    if (parsed.data.deliveries.length > 0) {
      await tx.templateDelivery.createMany({
        data: parsed.data.deliveries.map((d) => ({
          templateId: id,
          deliveryDestinationId: d.deliveryDestinationId,
          clientVisible: d.clientVisible,
          clientLabel: d.clientLabel || null,
          sortOrder: d.sortOrder,
        })),
      });
    }
  });

  const updated = await prisma.templateDelivery.findMany({
    where: { templateId: id },
    include: {
      deliveryDestination: {
        select: { id: true, name: true, type: true, isActive: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(updated);
}
