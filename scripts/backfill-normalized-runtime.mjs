import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {
  loadCommentsFromNormalized,
  loadPostsFromNormalized,
  loadPostVersionsFromNormalized,
  loadProjectsFromNormalized,
  loadUpdatesFromNormalized,
  loadUploadsFromNormalized,
  loadUsersFromNormalized,
  syncCommentsToNormalized,
  syncPostsToNormalized,
  syncPostVersionsToNormalized,
  syncProjectsToNormalized,
  syncUpdatesToNormalized,
  syncUploadsToNormalized,
  syncUsersToNormalized,
  upsertNormalizedRuntimeState,
} from "../server/lib/normalized-domain-store.js";
import { prisma } from "../server/lib/prisma-client.js";

const DEFAULT_DOMAINS = [
  "users",
  "uploads",
  "projects",
  "posts",
  "post_versions",
  "updates",
  "comments",
];

const parseArgs = (argv) =>
  argv.reduce(
    (acc, arg) => {
      if (arg.startsWith("--domains=")) {
        acc.domains = arg
          .slice("--domains=".length)
          .split(",")
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      } else if (arg.startsWith("--report=")) {
        acc.reportPath = String(arg.slice("--report=".length) || "").trim();
      }
      return acc;
    },
    { domains: [], reportPath: "" },
  );

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const cloneValue = (value) => JSON.parse(JSON.stringify(value ?? null));

const checksum = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");

const writeReport = async (reportPath, payload) => {
  const targetPath =
    reportPath ||
    path.resolve(
      process.cwd(),
      "backups",
      `normalized-runtime-quarantine-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
  return targetPath;
};

const loadLegacyState = async () => {
  const [
    ownerIds,
    allowedUsers,
    users,
    posts,
    postVersions,
    projects,
    updates,
    comments,
    uploads,
    userMfaTotp,
    userSessionIndex,
  ] = await Promise.all([
    prisma.ownerIdRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.allowedUserRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.userRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.postRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.postVersionRecord.findMany({ orderBy: { position: "asc" } }).catch(() => []),
    prisma.projectRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.updateRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.commentRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.uploadRecord.findMany({ orderBy: { position: "asc" } }),
    prisma.userMfaTotpRecord.findMany({}).catch(() => []),
    prisma.userSessionIndexRecord.findMany({ orderBy: { lastSeenAt: "desc" } }).catch(() => []),
  ]);

  return {
    ownerIds: ownerIds.map((row) => String(row?.userId || "")),
    allowedUsers: allowedUsers.map((row) => String(row?.userId || "")),
    users: users.map((row) => cloneValue(row?.data || {})),
    posts: posts.map((row) => cloneValue(row?.data || {})),
    postVersions: postVersions.map((row) => cloneValue(row?.data || {})),
    projects: projects.map((row) => cloneValue(row?.data || {})),
    updates: updates.map((row) => cloneValue(row?.data || {})),
    comments: comments.map((row) => cloneValue(row?.data || {})),
    uploads: uploads.map((row) => cloneValue(row?.data || {})),
    userMfaTotp: userMfaTotp.map((row) => String(row?.userId || "")),
    userSessionIndex: userSessionIndex.map((row) => ({
      sid: String(row?.sid || ""),
      userId: String(row?.userId || ""),
    })),
  };
};

const buildIntegrityReport = (legacy) => {
  const knownUserIds = new Set(ensureArray(legacy.users).map((entry) => String(entry?.id || "")));
  const uploadHashBuckets = new Map();
  ensureArray(legacy.uploads).forEach((entry) => {
    const hash = String(entry?.hashSha256 || "").trim();
    if (!hash) {
      return;
    }
    const bucket = uploadHashBuckets.get(hash) || [];
    bucket.push({
      id: String(entry?.id || ""),
      url: String(entry?.url || ""),
      fileName: String(entry?.fileName || ""),
    });
    uploadHashBuckets.set(hash, bucket);
  });
  return {
    orphanOwnerIds: ensureArray(legacy.ownerIds).filter((userId) => !knownUserIds.has(userId)),
    orphanAllowedUsers: ensureArray(legacy.allowedUsers).filter(
      (userId) => !knownUserIds.has(userId),
    ),
    orphanMfaUsers: ensureArray(legacy.userMfaTotp).filter((userId) => !knownUserIds.has(userId)),
    orphanSessionUsers: ensureArray(legacy.userSessionIndex)
      .filter((entry) => entry?.userId && !knownUserIds.has(String(entry.userId)))
      .map((entry) => cloneValue(entry)),
    duplicateUploadHashes: Array.from(uploadHashBuckets.entries())
      .filter(([, entries]) => entries.length > 1)
      .map(([hash, entries]) => ({
        hash,
        entries: cloneValue(entries),
      })),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const domains = args.domains.length > 0 ? args.domains : DEFAULT_DOMAINS;
  const legacy = await loadLegacyState();
  const report = {
    generatedAt: new Date().toISOString(),
    domains,
    integrity: buildIntegrityReport(legacy),
    quarantine: {},
  };

  if (domains.includes("users")) {
    const previous = await loadUsersFromNormalized(prisma);
    await syncUsersToNormalized(prisma, previous, legacy.users);
    await upsertNormalizedRuntimeState(prisma, "users", {
      status: "ready",
      rowCount: legacy.users.length,
      quarantineCount: 0,
      checksum: checksum(legacy.users),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  if (domains.includes("uploads")) {
    const previous = await loadUploadsFromNormalized(prisma);
    const result = await syncUploadsToNormalized(prisma, previous, legacy.uploads);
    await upsertNormalizedRuntimeState(prisma, "uploads", {
      status: "ready",
      rowCount: legacy.uploads.length,
      quarantineCount: 0,
      checksum: checksum(legacy.uploads),
      data: {
        backfilledAt: new Date().toISOString(),
        deduplicatedHashCount: Number(result?.deduplicatedHashCount || 0),
      },
    });
  }

  if (domains.includes("projects")) {
    const previous = await loadProjectsFromNormalized(prisma);
    await syncProjectsToNormalized(prisma, previous, legacy.projects);
    await upsertNormalizedRuntimeState(prisma, "projects", {
      status: "ready",
      rowCount: legacy.projects.length,
      quarantineCount: 0,
      checksum: checksum(legacy.projects),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  if (domains.includes("posts")) {
    const previous = await loadPostsFromNormalized(prisma);
    await syncPostsToNormalized(prisma, previous, legacy.posts);
    await upsertNormalizedRuntimeState(prisma, "posts", {
      status: "ready",
      rowCount: legacy.posts.length,
      quarantineCount: 0,
      checksum: checksum(legacy.posts),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  if (domains.includes("post_versions")) {
    const previous = await loadPostVersionsFromNormalized(prisma);
    await syncPostVersionsToNormalized(prisma, previous, legacy.postVersions);
    await upsertNormalizedRuntimeState(prisma, "post_versions", {
      status: "ready",
      rowCount: legacy.postVersions.length,
      quarantineCount: 0,
      checksum: checksum(legacy.postVersions),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  if (domains.includes("updates")) {
    const previous = await loadUpdatesFromNormalized(prisma);
    const loadedProjects = domains.includes("projects")
      ? legacy.projects
      : await loadProjectsFromNormalized(prisma);
    const normalizedProjects = loadedProjects.length > 0 ? loadedProjects : legacy.projects;
    const result = await syncUpdatesToNormalized(prisma, previous, legacy.updates, {
      projects: normalizedProjects,
    });
    report.quarantine.updates = cloneValue(result.quarantined || []);
    await upsertNormalizedRuntimeState(prisma, "updates", {
      status: "ready",
      rowCount: legacy.updates.length - ensureArray(result.quarantined).length,
      quarantineCount: ensureArray(result.quarantined).length,
      checksum: checksum(legacy.updates),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  if (domains.includes("comments")) {
    const loadedProjects = domains.includes("projects")
      ? legacy.projects
      : await loadProjectsFromNormalized(prisma);
    const loadedPosts = domains.includes("posts")
      ? legacy.posts
      : await loadPostsFromNormalized(prisma);
    const normalizedProjects = loadedProjects.length > 0 ? loadedProjects : legacy.projects;
    const normalizedPosts = loadedPosts.length > 0 ? loadedPosts : legacy.posts;
    const previousComments = await loadCommentsFromNormalized(prisma, {
      posts: normalizedPosts,
      projects: normalizedProjects,
    });
    const result = await syncCommentsToNormalized(prisma, previousComments, legacy.comments, {
      posts: normalizedPosts,
      projects: normalizedProjects,
    });
    report.quarantine.comments = cloneValue(result.quarantined || []);
    await upsertNormalizedRuntimeState(prisma, "comments", {
      status: "ready",
      rowCount: legacy.comments.length - ensureArray(result.quarantined).length,
      quarantineCount: ensureArray(result.quarantined).length,
      checksum: checksum(legacy.comments),
      data: { backfilledAt: new Date().toISOString() },
    });
  }

  const reportPath = await writeReport(args.reportPath, report);
  console.log(
    JSON.stringify(
      {
        ok: true,
        domains,
        reportPath,
        quarantineCounts: Object.fromEntries(
          Object.entries(report.quarantine).map(([key, value]) => [key, ensureArray(value).length]),
        ),
        integrityCounts: Object.fromEntries(
          Object.entries(report.integrity).map(([key, value]) => [key, ensureArray(value).length]),
        ),
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  await prisma.$disconnect?.().catch(() => undefined);
}
