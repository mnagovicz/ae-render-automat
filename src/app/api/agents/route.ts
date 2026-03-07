import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const agents = await prisma.renderAgent.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const apiKey = randomUUID();

  const agent = await prisma.renderAgent.create({
    data: {
      name,
      hostname: body.hostname?.trim() || null,
      apiKey,
      status: "offline",
    },
  });

  // Return the agent with the API key — this is the only time the key is visible
  return NextResponse.json(agent, { status: 201 });
}
