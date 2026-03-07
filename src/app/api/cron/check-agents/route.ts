import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Dead agent detection + stuck job timeout
// Call periodically via cron (every 1-2 minutes)

const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max render time

const IN_PROGRESS_STATUSES = [
  "DOWNLOADING",
  "GENERATING_TTS",
  "RENDERING",
  "MIXING",
  "UPLOADING",
];

export async function GET() {
  const now = Date.now();
  const heartbeatThreshold = new Date(now - HEARTBEAT_TIMEOUT_MS);
  const jobTimeoutThreshold = new Date(now - JOB_TIMEOUT_MS);

  let resetByAgent = 0;
  let resetByTimeout = 0;

  // ── 1. Dead agent detection ──
  // Find agents that are "busy" but haven't sent a heartbeat recently
  const staleAgents = await prisma.renderAgent.findMany({
    where: {
      status: "busy",
      lastHeartbeat: { lt: heartbeatThreshold },
    },
  });

  for (const agent of staleAgents) {
    const result = await prisma.renderJob.updateMany({
      where: {
        agentId: agent.id,
        status: { in: IN_PROGRESS_STATUSES },
      },
      data: {
        status: "PENDING",
        agentId: null,
        progress: 0,
        errorMessage: `Agent "${agent.name}" became unresponsive, job reset to queue`,
      },
    });

    resetByAgent += result.count;

    await prisma.renderAgent.update({
      where: { id: agent.id },
      data: { status: "offline", currentJobId: null },
    });

    console.log(
      `[Cron] Agent "${agent.name}" marked offline, reset ${result.count} job(s)`
    );
  }

  // ── 2. Stuck job timeout ──
  // Find jobs that have been processing for too long (even if agent is alive)
  const stuckJobs = await prisma.renderJob.updateMany({
    where: {
      status: { in: IN_PROGRESS_STATUSES },
      startedAt: { lt: jobTimeoutThreshold },
      // Only reset jobs not already handled by dead agent detection above
      agentId: {
        notIn: staleAgents.map((a) => a.id),
      },
    },
    data: {
      status: "FAILED",
      errorMessage: `Job timed out after ${JOB_TIMEOUT_MS / 60000} minutes`,
    },
  });

  resetByTimeout = stuckJobs.count;

  if (resetByTimeout > 0) {
    console.log(`[Cron] ${resetByTimeout} job(s) timed out and marked FAILED`);
  }

  return NextResponse.json({
    checkedAgents: staleAgents.length,
    resetByAgent,
    resetByTimeout,
  });
}
