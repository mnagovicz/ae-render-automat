/**
 * Migration script: Fix jobData keys after template variables were recreated with new IDs.
 *
 * Problem: Variables endpoint used delete-all + create-new, so existing jobData.key
 * references old (deleted) variable UUIDs that no longer match current variable IDs.
 *
 * Strategy:
 * 1. Find all orphaned jobData (key doesn't match any current TemplateVariable)
 * 2. Group by template
 * 3. For each template, collect the set of old keys from jobData and current variable IDs
 * 4. Match old keys to new variables by their position (sortOrder was preserved)
 * 5. Update jobData keys to current variable IDs
 *
 * Run: npx tsx scripts/fix-job-data-keys.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new (PrismaClient as any)({ adapter }) as any;

async function main() {
  // Get all templates with their current variables
  const templates = await prisma.template.findMany({
    include: {
      variables: { orderBy: { sortOrder: "asc" } },
    },
  });

  let totalFixed = 0;

  for (const template of templates) {
    if (template.variables.length === 0) continue;

    const currentVarIds = new Set(template.variables.map((v) => v.id));

    // Get all jobs for this template with their jobData
    const jobs = await prisma.renderJob.findMany({
      where: { templateId: template.id },
      include: { jobData: true },
    });

    // Collect orphaned keys (keys that don't match any current variable)
    const orphanedKeys = new Set<string>();
    for (const job of jobs) {
      for (const jd of job.jobData) {
        if (!currentVarIds.has(jd.key)) {
          orphanedKeys.add(jd.key);
        }
      }
    }

    if (orphanedKeys.size === 0) continue;

    // Sort orphaned keys by how they appear across jobs (use first job as reference)
    const referenceJob = jobs.find((j) => j.jobData.some((d) => orphanedKeys.has(d.key)));
    if (!referenceJob) continue;

    // Get orphaned data entries in creation order (which follows variable sortOrder)
    const orphanedEntries = referenceJob.jobData
      .filter((d) => orphanedKeys.has(d.key))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Build mapping: old key → new variable ID (by position)
    const keyMapping = new Map<string, string>();
    const seenOldKeys = new Set<string>();

    for (const entry of orphanedEntries) {
      if (seenOldKeys.has(entry.key)) continue;
      seenOldKeys.add(entry.key);

      const idx = seenOldKeys.size - 1;
      if (idx < template.variables.length) {
        keyMapping.set(entry.key, template.variables[idx].id);
      }
    }

    if (keyMapping.size === 0) continue;

    console.log(`\nTemplate: ${template.name} (${template.id})`);
    console.log(`  Current variables: ${template.variables.map((v) => `${v.label}=${v.id}`).join(", ")}`);
    console.log(`  Key mapping:`);
    for (const [oldKey, newId] of keyMapping) {
      const varLabel = template.variables.find((v) => v.id === newId)?.label;
      console.log(`    ${oldKey} → ${newId} (${varLabel})`);
    }

    // Apply the mapping
    for (const [oldKey, newId] of keyMapping) {
      const result = await prisma.jobData.updateMany({
        where: { key: oldKey },
        data: { key: newId },
      });
      totalFixed += result.count;
      console.log(`  Updated ${result.count} jobData records: ${oldKey} → ${newId}`);
    }
  }

  console.log(`\nDone! Fixed ${totalFixed} jobData records total.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
