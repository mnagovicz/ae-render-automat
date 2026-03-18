import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const slotSchema = z.object({
  id: z.string().optional(),
  footageItemName: z.string().min(1),
  folderPath: z.string().default(""),
  label: z.string().min(1),
  allowedFormats: z.array(z.string()).optional(),
  maxFileSize: z.number().optional(),
  sortOrder: z.number().default(0),
  clientVisible: z.boolean().default(false),
  clientLabel: z.string().optional(),
});

const bulkSchema = z.object({
  slots: z.array(slotSchema),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const slots = await prisma.footageSlot.findMany({
    where: { templateId: id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(slots);
}

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
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const incoming = parsed.data.slots;
    const existingIds = incoming.map((s) => s.id).filter(Boolean) as string[];

    await prisma.$transaction(async (tx: typeof prisma) => {
      // Delete slots that are no longer in the list
      await tx.footageSlot.deleteMany({
        where: {
          templateId: id,
          id: { notIn: existingIds },
        },
      });

      // Upsert each slot to preserve IDs
      for (let i = 0; i < incoming.length; i++) {
        const { id: slotId, ...data } = incoming[i];
        const slotData = { ...data, templateId: id, sortOrder: data.sortOrder ?? i };

        if (slotId) {
          await tx.footageSlot.update({
            where: { id: slotId },
            data: slotData,
          });
        } else {
          await tx.footageSlot.create({
            data: slotData,
          });
        }
      }
    });
  } catch (err) {
    console.error("Footage slots save error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const slots = await prisma.footageSlot.findMany({
    where: { templateId: id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(slots);
}
