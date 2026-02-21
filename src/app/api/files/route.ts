import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "@/lib/s3";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileName, contentType, action } = await req.json();

  if (action === "upload") {
    const key = `uploads/${randomUUID()}/${fileName}`;
    const url = await getPresignedUploadUrl(key, contentType);
    return NextResponse.json({ url, key });
  }

  if (action === "download") {
    const url = await getPresignedDownloadUrl(fileName);
    return NextResponse.json({ url });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
