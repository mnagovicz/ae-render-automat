import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Dead agent detection - call periodically (e.g. every minute via cron)
// Resets jobs from agents that haven't sent heartbeat in 2+ minutes
export async function GET() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  // Find agents with stale heartbeat that are currently busy
  const staleAgents = await prisma.renderAgent.findMany({
    where: {
      status: "busy",
      lastHeartbeat: { lt: twoMinutesAgo },
    },
  });

  let resetCount = 0;

  for (const agent of staleAgents) {
    // Reset jobs assigned to this dead agent
    const result = await prisma.renderJob.updateMany({
      where: {
        agentId: agent.id,
        status: { in: ["DOWNLOADING", "RENDERING", "UPLOADING"] },
      },
      data: {
        status: "PENDING",
        agentId: null,
        progress: 0,
        errorMessage: `Agent ${agent.name} became unresponsive`,
      },
    });

    resetCount += result.count;

    // Mark agent as offline
    await prisma.renderAgent.update({
      where: { id: agent.id },
      data: { status: "offline", currentJobId: null },
    });

    console.log(
      `[Cron] Agent ${agent.name} marked offline, reset ${result.count} jobs`
    );
  }

  return NextResponse.json({
    checkedAgents: staleAgents.length,
    resetJobs: resetCount,
  });
}
