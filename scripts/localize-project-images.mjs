import fs from "fs";
import path from "path";
import crypto from "crypto";
import { importRemoteImageFile } from "../server/lib/remote-image-import.js";
import {
  RELATIONS_SHARED_FOLDER,
  buildRelationImageFileBase,
  localizeProjectImageFields,
} from "../server/lib/project-image-localizer.js";

const APPLY_FLAG = "--apply";
const HELP_FLAG = "--help";
const PROJECT_FLAG = "--project";

const MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const printHelp = () => {
  console.log("Uso:");
  console.log("  node scripts/localize-project-images.mjs");
  console.log("  node scripts/localize-project-images.mjs --apply");
  console.log("  node scripts/localize-project-images.mjs --apply --project <id>");
  console.log("  node scripts/localize-project-images.mjs --help");
};

const args = process.argv.slice(2);
if (args.includes(HELP_FLAG)) {
  printHelp();
  process.exit(0);
}

const applyChanges = args.includes(APPLY_FLAG);
let targetProjectId = "";
const projectFlagIndex = args.findIndex((item) => item === PROJECT_FLAG);
if (projectFlagIndex >= 0) {
  targetProjectId = String(args[projectFlagIndex + 1] || "").trim();
  if (!targetProjectId) {
    console.error("Erro: informe um ID apos --project.");
    process.exit(1);
  }
}

const rootDir = path.resolve(process.cwd());
const dataDir = path.join(rootDir, "server", "data");
const uploadsDir = path.join(rootDir, "public", "uploads");
const projectsPath = path.join(dataDir, "projects.json");
const uploadsPath = path.join(dataDir, "uploads.json");

const readJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const upsertUploadEntries = (existingUploads, incomingEntries) => {
  const current = Array.isArray(existingUploads) ? existingUploads : [];
  const byUrl = new Map(
    current
      .filter((item) => item?.url)
      .map((item) => [String(item.url), item]),
  );
  let changed = false;
  (Array.isArray(incomingEntries) ? incomingEntries : []).forEach((entry) => {
    const nextUrl = String(entry?.url || "").trim();
    if (!nextUrl || !nextUrl.startsWith("/uploads/")) {
      return;
    }
    const previous = byUrl.get(nextUrl);
    const next = {
      ...(previous || {}),
      ...entry,
      id: previous?.id || entry?.id || crypto.randomUUID(),
      url: nextUrl,
      fileName: String(entry?.fileName || previous?.fileName || ""),
      folder: String(entry?.folder || previous?.folder || ""),
      size: Number.isFinite(entry?.size) ? Number(entry.size) : previous?.size ?? null,
      mime: String(entry?.mime || previous?.mime || ""),
      width: Number.isFinite(entry?.width) ? Number(entry.width) : previous?.width ?? null,
      height: Number.isFinite(entry?.height) ? Number(entry.height) : previous?.height ?? null,
      createdAt: String(entry?.createdAt || previous?.createdAt || new Date().toISOString()),
    };
    if (JSON.stringify(previous || null) !== JSON.stringify(next)) {
      changed = true;
    }
    byUrl.set(nextUrl, next);
  });
  return {
    changed,
    uploads: Array.from(byUrl.values()).sort((a, b) =>
      String(a.url || "").localeCompare(String(b.url || ""), "en"),
    ),
  };
};

const normalizeUploadPath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("/uploads/")) {
    return raw.split("?")[0].split("#")[0];
  }
  try {
    const parsed = new URL(raw);
    if (parsed.pathname && parsed.pathname.startsWith("/uploads/")) {
      return parsed.pathname;
    }
  } catch {
    // ignore invalid values
  }
  return null;
};

const toUploadRelativePath = (uploadUrl) =>
  String(uploadUrl || "")
    .replace(/^\/uploads\//, "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

const isRelationSharedUpload = (uploadUrl) =>
  String(uploadUrl || "").startsWith(`/uploads/${RELATIONS_SHARED_FOLDER}/`);

const normalizeExtension = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace(/^\./, "");
  if (!raw) {
    return "";
  }
  if (raw === "jpg") {
    return "jpeg";
  }
  return raw;
};

const getMimeFromFileName = (fileName) => {
  const ext = normalizeExtension(path.extname(String(fileName || "")));
  return MIME_BY_EXTENSION[ext] || "";
};

const moveFile = (sourcePath, targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch {
    fs.copyFileSync(sourcePath, targetPath);
    try {
      fs.unlinkSync(sourcePath);
    } catch {
      // ignore source cleanup failure when fallback copy succeeds
    }
  }
};

const buildUploadEntryFromDisk = (uploadUrl, diskPath) => {
  const stat = fs.statSync(diskPath);
  const relative = toUploadRelativePath(uploadUrl);
  return {
    url: uploadUrl,
    fileName: path.posix.basename(relative),
    folder: path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative),
    size: Number(stat.size || 0),
    mime: getMimeFromFileName(relative),
    width: null,
    height: null,
    createdAt: stat.mtime.toISOString(),
  };
};

const migrateLocalRelationUploads = ({ project, uploadsDirPath, apply }) => {
  const nextProject = {
    ...project,
    relations: Array.isArray(project?.relations) ? project.relations.map((item) => ({ ...item })) : [],
  };
  const summary = {
    attempted: 0,
    migrated: 0,
    reused: 0,
    failed: 0,
    alreadyShared: 0,
    dryRunEligible: 0,
  };
  const failures = [];
  const uploadsToUpsert = [];
  const upsertedUrls = new Set();

  nextProject.relations.forEach((relation, index) => {
    const rawImage = String(relation?.image || "").trim();
    if (!rawImage) {
      return;
    }
    const normalizedLocal = normalizeUploadPath(rawImage);
    if (!normalizedLocal) {
      return;
    }

    if (isRelationSharedUpload(normalizedLocal)) {
      summary.alreadyShared += 1;
      if (apply && normalizedLocal !== rawImage) {
        nextProject.relations[index] = {
          ...nextProject.relations[index],
          image: normalizedLocal,
        };
      }
      return;
    }

    summary.attempted += 1;

    const sourceRelative = toUploadRelativePath(normalizedLocal);
    const sourceExt = normalizeExtension(path.extname(sourceRelative));
    const relationBase = buildRelationImageFileBase({ relation, sourceUrl: normalizedLocal });
    const targetExt = sourceExt || "png";
    const targetRelative = `${RELATIONS_SHARED_FOLDER}/${relationBase}.${targetExt}`;
    const targetUrl = `/uploads/${targetRelative}`;

    if (!apply) {
      summary.dryRunEligible += 1;
      return;
    }

    const sourcePath = path.join(uploadsDirPath, sourceRelative);
    const targetPath = path.join(uploadsDirPath, targetRelative);

    try {
      let reused = false;
      if (fs.existsSync(targetPath)) {
        reused = true;
      } else if (fs.existsSync(sourcePath)) {
        moveFile(sourcePath, targetPath);
      } else {
        throw new Error("missing_source_file");
      }

      nextProject.relations[index] = {
        ...nextProject.relations[index],
        image: targetUrl,
      };

      if (!upsertedUrls.has(targetUrl) && fs.existsSync(targetPath)) {
        uploadsToUpsert.push(buildUploadEntryFromDisk(targetUrl, targetPath));
        upsertedUrls.add(targetUrl);
      }

      summary.migrated += 1;
      if (reused) {
        summary.reused += 1;
      }
    } catch (error) {
      summary.failed += 1;
      failures.push({
        field: `relations[${index}].image`,
        url: normalizedLocal,
        error: String(error?.message || "local_relation_migration_failed"),
      });
    }
  });

  return {
    project: apply ? nextProject : project,
    summary,
    failures,
    uploadsToUpsert,
  };
};

const projects = readJson(projectsPath, []);
if (!Array.isArray(projects)) {
  console.error("Erro: projects.json invalido.");
  process.exit(1);
}
const uploads = readJson(uploadsPath, []);
if (!Array.isArray(uploads)) {
  console.error("Erro: uploads.json invalido.");
  process.exit(1);
}

const scopedProjects = targetProjectId
  ? projects
      .map((project, index) => ({ project, index }))
      .filter((item) => String(item.project?.id || "") === targetProjectId)
  : projects.map((project, index) => ({ project, index }));

if (targetProjectId && scopedProjects.length === 0) {
  console.error(`Projeto "${targetProjectId}" nao encontrado.`);
  process.exit(1);
}

const importer = applyChanges
  ? ({ remoteUrl, folder, fileBaseOverride, deterministic, onExisting }) =>
      importRemoteImageFile({
        remoteUrl,
        folder,
        uploadsDir,
        fileBaseOverride,
        deterministic,
        onExisting,
      })
  : async () => ({
      ok: false,
      error: { code: "dry_run_skip" },
    });

const nextProjects = [...projects];
const aggregatedUploads = [];
const perProjectReports = [];
const totals = {
  attempted: 0,
  downloaded: 0,
  failed: 0,
  skippedLocal: 0,
  normalizedLocalAbsolute: 0,
  dryRunSkipped: 0,
  relationLegacyAttempted: 0,
  relationLegacyMigrated: 0,
  relationLegacyReused: 0,
  relationLegacyFailed: 0,
  relationLegacyDryRunEligible: 0,
};

for (const item of scopedProjects) {
  const result = await localizeProjectImageFields({
    project: item.project,
    importRemoteImage: importer,
    maxConcurrent: 4,
  });

  const relationMigration = migrateLocalRelationUploads({
    project: result.project,
    uploadsDirPath: uploadsDir,
    apply: applyChanges,
  });

  const dryRunSkipped = result.failures.filter((failure) => failure.error === "dry_run_skip").length;
  const effectiveFailed = Math.max(0, Number(result.summary.failed || 0) - dryRunSkipped);

  totals.attempted += Number(result.summary.attempted || 0);
  totals.downloaded += Number(result.summary.downloaded || 0);
  totals.failed += effectiveFailed;
  totals.skippedLocal += Number(result.summary.skippedLocal || 0);
  totals.normalizedLocalAbsolute += Number(result.summary.normalizedLocalAbsolute || 0);
  totals.dryRunSkipped += dryRunSkipped;
  totals.relationLegacyAttempted += Number(relationMigration.summary.attempted || 0);
  totals.relationLegacyMigrated += Number(relationMigration.summary.migrated || 0);
  totals.relationLegacyReused += Number(relationMigration.summary.reused || 0);
  totals.relationLegacyFailed += Number(relationMigration.summary.failed || 0);
  totals.relationLegacyDryRunEligible += Number(relationMigration.summary.dryRunEligible || 0);

  if (applyChanges) {
    nextProjects[item.index] = relationMigration.project;
    aggregatedUploads.push(...result.uploadsToUpsert, ...relationMigration.uploadsToUpsert);
  }

  perProjectReports.push({
    id: String(item.project?.id || ""),
    attempted: Number(result.summary.attempted || 0),
    downloaded: Number(result.summary.downloaded || 0),
    failed: effectiveFailed,
    skippedLocal: Number(result.summary.skippedLocal || 0),
    normalizedLocalAbsolute: Number(result.summary.normalizedLocalAbsolute || 0),
    relationLegacyAttempted: Number(relationMigration.summary.attempted || 0),
    relationLegacyMigrated: Number(relationMigration.summary.migrated || 0),
    relationLegacyFailed: Number(relationMigration.summary.failed || 0),
  });
}

console.log(`Modo: ${applyChanges ? "apply" : "dry-run"}`);
console.log(`Projetos analisados: ${scopedProjects.length}`);
console.log(`Tentativas de localizacao (URLs remotas): ${totals.attempted}`);
console.log(`Downloads aplicados: ${totals.downloaded}`);
if (!applyChanges) {
  console.log(`Dry-run sem download/escrita. Itens elegiveis remotos: ${totals.attempted}`);
}
console.log(`Falhas de importacao: ${totals.failed}`);
console.log(`Ja locais (/uploads): ${totals.skippedLocal}`);
console.log(`Normalizados de absoluto para relativo: ${totals.normalizedLocalAbsolute}`);
console.log(`Relations locais legadas detectadas: ${totals.relationLegacyAttempted}`);
if (applyChanges) {
  console.log(`Relations locais legadas migradas: ${totals.relationLegacyMigrated}`);
  console.log(`Relations reaproveitadas em target existente: ${totals.relationLegacyReused}`);
  console.log(`Falhas na migracao local de relations: ${totals.relationLegacyFailed}`);
} else {
  console.log(`Dry-run de relations locais elegiveis: ${totals.relationLegacyDryRunEligible}`);
}

const touchedProjects = perProjectReports.filter(
  (item) =>
    item.attempted > 0 ||
    item.normalizedLocalAbsolute > 0 ||
    item.relationLegacyAttempted > 0,
);
if (touchedProjects.length > 0) {
  console.log("\nResumo por projeto:");
  touchedProjects.forEach((item) => {
    console.log(
      `- ${item.id}: remotas tentativas=${item.attempted}, downloads=${item.downloaded}, falhas=${item.failed}, normalizados=${item.normalizedLocalAbsolute}, relations_legado tentativas=${item.relationLegacyAttempted}, migradas=${item.relationLegacyMigrated}, falhas=${item.relationLegacyFailed}`,
    );
  });
}

if (applyChanges) {
  writeJson(projectsPath, nextProjects);
  const upsertResult = upsertUploadEntries(uploads, aggregatedUploads);
  if (upsertResult.changed) {
    writeJson(uploadsPath, upsertResult.uploads);
  }
  console.log(`\nArquivos atualizados: ${path.relative(rootDir, projectsPath)}, ${path.relative(rootDir, uploadsPath)}`);
  console.log(`Registros de uploads adicionados/atualizados: ${aggregatedUploads.length}`);
}