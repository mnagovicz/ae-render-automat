import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(UserRole).default(UserRole.CLIENT),
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

// POST /api/organizations/[id]/members - Add a member to an organization
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

  const { email, role } = parsed.data;

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

  // Find the user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json(
      { error: "No user found with this email address" },
      { status: 404 }
    );
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
      role,
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

  return NextResponse.json(member, { status: 201 });
}
