import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const agent = await prisma.renderAgent.findUnique({
    where: { apiKey },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  await prisma.renderAgent.update({
    where: { id: agent.id },
    data: { lastHeartbeat: new Date() },
  });

  return NextResponse.json({ ok: true });
}
