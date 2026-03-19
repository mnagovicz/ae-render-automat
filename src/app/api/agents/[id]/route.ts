import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, string | null> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.hostname !== undefined) data.hostname = body.hostname?.trim() || null;
  if (body.regenerateKey) data.apiKey = randomUUID();

  const agent = await prisma.renderAgent.update({
    where: { id },
    data,
  });

  return NextResponse.json(agent);
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

  await prisma.renderAgent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
