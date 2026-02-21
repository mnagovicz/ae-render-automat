import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    )
    .optional(),
});

// GET /api/organizations/[id] - Get a single organization with members
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
    include: {
      members: {
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
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!organization) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(organization);
}

// PUT /api/organizations/[id] - Update an organization
export async function PUT(
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

  const parsed = updateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check the organization exists
  const existing = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // If slug is being updated, check for duplicate
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugExists = await prisma.organization.findUnique({
      where: { slug: parsed.data.slug },
    });

    if (slugExists) {
      return NextResponse.json(
        { error: "An organization with this slug already exists" },
        { status: 409 }
      );
    }
  }

  const organization = await prisma.organization.update({
    where: { id },
    data: parsed.data,
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  return NextResponse.json(organization);
}

// DELETE /api/organizations/[id] - Delete an organization
export async function DELETE(
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

  const existing = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  await prisma.organization.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
