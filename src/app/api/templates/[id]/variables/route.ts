import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const variableSchema = z.object({
  id: z.string().uuid().optional(),
  layerName: z.string().min(1),
  effectName: z.string().min(1),
  effectType: z.string().default("Slider"),
  type: z.enum(["SLIDER", "CHECKBOX", "TEXT", "IMAGE", "SELECT", "COLOR", "VOICEOVER"]),
  label: z.string().min(1),
  groupName: z.string().optional(),
  validation: z.any().optional(),
  defaultValue: z.string().optional(),
  sortOrder: z.number().default(0),
  row: z.number().default(0),
  lines: z.number().default(1),
  clientVisible: z.boolean().default(false),
  clientLabel: z.string().optional(),
});

const bulkSchema = z.object({
  variables: z.array(variableSchema),
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
  const variables = await prisma.templateVariable.findMany({
    where: { templateId: id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(variables);
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
    // Separate existing (have id) from new variables
    const incoming = parsed.data.variables;
    const existingIds = incoming.map((v) => v.id).filter(Boolean) as string[];

    await prisma.$transaction(async (tx: typeof prisma) => {
      // Delete variables that are no longer in the list
      await tx.templateVariable.deleteMany({
        where: {
          templateId: id,
          id: { notIn: existingIds },
        },
      });

      // Upsert each variable to preserve IDs
      for (let i = 0; i < incoming.length; i++) {
        const { id: varId, ...data } = incoming[i];
        const varData = { ...data, templateId: id, sortOrder: data.sortOrder ?? i };

        if (varId) {
          await tx.templateVariable.update({
            where: { id: varId },
            data: varData,
          });
        } else {
          await tx.templateVariable.create({
            data: varData,
          });
        }
      }
    });

    const variables = await prisma.templateVariable.findMany({
      where: { templateId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(variables);
  } catch (err) {
    console.error("Variables PUT error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
