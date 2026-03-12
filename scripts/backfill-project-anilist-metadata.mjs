import "dotenv/config";

import fs from "fs/promises";
import path from "path";

import { fetchAniListMediaById } from "../server/lib/anilist-client.js";
import { createDataRepository } from "../server/lib/data-repository.js";
import { prisma } from "../server/lib/prisma-client.js";
import {
  hasAniListOrganizationChanges,
  mergeAniListOrganizationIntoProject,
} from "../server/lib/project-anilist-metadata.js";
import { deriveAniListMediaOrganization } from "../src/lib/anilist-media.js";

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 750;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = (argv) =>
  argv.reduce(
    (acc, arg) => {
      if (arg.startsWith("--report=")) {
        acc.reportPath = String(arg.slice("--report=".length) || "").trim();
        return acc;
      }
      if (arg.startsWith("--id=")) {
        acc.projectIds.push(
          ...arg
            .slice("--id=".length)
            .split(",")
            .map((item) => String(item || "").trim())
            .filter(Boolean),
        );
      }
      return acc;
    },
    { reportPath: "", projectIds: [] },
  );

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

const getTargetProjects = (projects, projectIds) => {
  const requestedIds = new Set(projectIds);
  return (Array.isArray(projects) ? projects : []).filter((project) => {
    if (project?.deletedAt) {
      return false;
    }
    const anilistId = Number(project?.anilistId);
    if (!isPositiveInteger(anilistId)) {
      return false;
    }
    if (requestedIds.size === 0) {
      return true;
    }
    return requestedIds.has(String(project?.id || "").trim());
  });
};

const writeReport = async (reportPath, report) => {
  const targetPath =
    reportPath ||
    path.resolve(
      process.cwd(),
      "backups",
      `project-anilist-backfill-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(report, null, 2), "utf8");
  return targetPath;
};

const fetchAniListMediaWithRetry = async (anilistId) => {
  let lastResult = null;
  for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
    const result = await fetchAniListMediaById(anilistId);
    lastResult = result;
    if (result.ok || !result.retryable || attempt === DEFAULT_RETRY_ATTEMPTS) {
      return result;
    }
    await delay(DEFAULT_RETRY_DELAY_MS * attempt);
  }
  return lastResult;
};

const main = async () => {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("DATABASE_URL is required");
  }

  const args = parseArgs(process.argv.slice(2));
  const repository = await createDataRepository({
    databaseUrl: process.env.DATABASE_URL,
    ownerIdsFallback: [],
    analyticsSchemaVersion: 1,
    analyticsRetentionDays: 365,
    analyticsAggRetentionDays: 365,
  });

  const currentProjects = repository.loadProjects();
  const targetProjects = getTargetProjects(currentProjects, args.projectIds);
  const nextProjects = [...currentProjects];
  const projectIndexById = new Map(
    currentProjects.map((project, index) => [String(project?.id || ""), index]),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    filters: {
      projectIds: args.projectIds,
    },
    totals: {
      scanned: targetProjects.length,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    updatedIds: [],
    skippedIds: [],
    failed: [],
  };

  for (const project of targetProjects) {
    const projectId = String(project?.id || "");
    const anilistId = Number(project?.anilistId);
    const result = await fetchAniListMediaWithRetry(anilistId);

    if (!result?.ok) {
      report.totals.failed += 1;
      report.failed.push({
        projectId,
        anilistId,
        error: String(result?.error || "anilist_failed"),
        status: result?.status ?? null,
      });
      continue;
    }

    if (!result.media) {
      report.totals.failed += 1;
      report.failed.push({
        projectId,
        anilistId,
        error: "media_not_found",
        status: result?.status ?? 200,
      });
      continue;
    }

    const organization = deriveAniListMediaOrganization(result.media);
    const mergedProject = mergeAniListOrganizationIntoProject(project, organization);
    if (!hasAniListOrganizationChanges(project, mergedProject)) {
      report.totals.skipped += 1;
      report.skippedIds.push(projectId);
      continue;
    }

    const nextProject = {
      ...mergedProject,
      updatedAt: new Date().toISOString(),
    };
    const index = projectIndexById.get(projectId);
    if (!Number.isInteger(index) || index < 0) {
      report.totals.failed += 1;
      report.failed.push({
        projectId,
        anilistId,
        error: "project_index_not_found",
        status: null,
      });
      continue;
    }

    nextProjects[index] = nextProject;
    report.totals.updated += 1;
    report.updatedIds.push(projectId);
  }

  if (report.totals.updated > 0) {
    repository.writeProjects(nextProjects);
    await repository.persistQueue;
  }

  const reportPath = await writeReport(args.reportPath, report);
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...report.totals,
        reportPath,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error || "unknown_error"),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
