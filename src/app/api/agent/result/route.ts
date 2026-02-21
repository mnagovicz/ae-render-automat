import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const resultSchema = z.object({
  jobId: z.string(),
  outputMp4Url: z.string().optional(),
  outputAepUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const agent = await prisma.renderAgent.findUnique({ where: { apiKey } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await prisma.renderJob.update({
    where: { id: parsed.data.jobId },
    data: {
      outputMp4Url: parsed.data.outputMp4Url,
      outputAepUrl: parsed.data.outputAepUrl,
    },
  });

  return NextResponse.json(job);
}
