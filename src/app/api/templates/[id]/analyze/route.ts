import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeAep } from "@/lib/aep-analyzer";
import { downloadFromS3 } from "@/lib/s3";

// ─── POST /api/templates/[id]/analyze ───────────────────
// Analyzes an AEP file associated with a template.
//
// Accepts either:
//   1. A template that already has an aepFileUrl (downloads from S3)
//   2. A multipart/form-data upload with field "file" containing the .aep binary
//
// Returns the AepAnalysis JSON with compositions, controllers, footage items, and fonts.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth Check ──
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "OPERATOR") {
    return NextResponse.json(
      { error: "Forbidden: only ADMIN and OPERATOR roles can analyze templates" },
      { status: 403 }
    );
  }

  // ── Get Template ──
  const { id } = await params;

  const template = await prisma.template.findUnique({
    where: { id },
  });

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  // ── Get AEP Buffer ──
  let aepBuffer: Buffer;

  try {
    // Strategy 1: If the template has an S3 key, download it
    if (template.aepFileUrl) {
      aepBuffer = await downloadFromS3(template.aepFileUrl);
    }
    // Strategy 2: Accept file upload via FormData
    else {
      const contentType = req.headers.get("content-type") || "";

      if (!contentType.includes("multipart/form-data")) {
        return NextResponse.json(
          {
            error:
              "Template has no AEP file URL. Upload an AEP file as multipart/form-data with field name 'file'.",
          },
          { status: 400 }
        );
      }

      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: "No 'file' field found in form data" },
          { status: 400 }
        );
      }

      // Validate file type by name (if available)
      if (file instanceof File && file.name) {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith(".aep") && !fileName.endsWith(".aepx")) {
          return NextResponse.json(
            { error: "File must be an After Effects project (.aep or .aepx)" },
            { status: 400 }
          );
        }
      }

      // Validate file size (max 500MB)
      const MAX_SIZE = 500 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size is 500MB, got ${Math.round(file.size / 1024 / 1024)}MB` },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      aepBuffer = Buffer.from(arrayBuffer);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to read AEP file: ${message}` },
      { status: 500 }
    );
  }

  // ── Validate Buffer ──
  if (aepBuffer.length < 12) {
    return NextResponse.json(
      { error: "AEP file is too small to be valid" },
      { status: 400 }
    );
  }

  // ── Run Analysis ──
  try {
    const analysis = analyzeAep(aepBuffer);

    return NextResponse.json({
      templateId: template.id,
      templateName: template.name,
      fileSize: aepBuffer.length,
      analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AEP analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
