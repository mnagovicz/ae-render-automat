import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(6).optional(),
});

const deleteMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// GET /api/organizations/[id]/members - List members of an organization
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(members);
}

// POST /api/organizations/[id]/members - Add a member (auto-creates user if needed)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, name, password } = parsed.data;

  // Check the organization exists
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // Find or create the user
  let user = await prisma.user.findUnique({
    where: { email },
  });

  let generatedPassword: string | null = null;
  let userCreated = false;

  if (!user) {
    const plainPassword = password || crypto.randomBytes(10).toString("base64url");
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: UserRole.CLIENT,
      },
    });

    generatedPassword = plainPassword;
    userCreated = true;
  }

  // Check if the user is already a member
  const existingMembership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: id,
      },
    },
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: "User is already a member of this organization" },
      { status: 409 }
    );
  }

  const member = await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: id,
      role: UserRole.CLIENT,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ...member,
      userCreated,
      generatedPassword,
    },
    { status: 201 }
  );
}

// DELETE /api/organizations/[id]/members - Remove a member from an organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId } = parsed.data;

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: id,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  await prisma.organizationMember.delete({
    where: { id: membership.id },
  });

  return NextResponse.json({ success: true });
}
