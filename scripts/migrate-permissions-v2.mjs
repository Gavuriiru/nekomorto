import crypto from "crypto";
import fs from "fs";
import path from "path";

const PERMISSION_IDS = [
  "posts",
  "projetos",
  "comentarios",
  "paginas",
  "uploads",
  "analytics",
  "usuarios_basico",
  "usuarios_acesso",
  "configuracoes",
  "audit_log",
  "integracoes",
];

const ACCESS_ROLES = ["normal", "admin", "owner_secondary", "owner_primary"];
const DEFAULT_ADMIN_PERMISSIONS = [
  "posts",
  "projetos",
  "comentarios",
  "paginas",
  "uploads",
  "analytics",
  "usuarios_basico",
];

const ADMIN_BADGE_LEGACY_PERMISSIONS = [
  "posts",
  "projetos",
  "comentarios",
  "usuarios",
  "paginas",
  "configuracoes",
];

const cwd = process.cwd();
const dataDir = path.join(cwd, "server", "data");
const usersFilePath = path.join(dataDir, "users.json");
const ownerIdsFilePath = path.join(dataDir, "owner-ids.json");
const auditLogFilePath = path.join(dataDir, "audit-log.json");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const dryRun = !apply || args.has("--dry-run");

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const readJson = (filePath, fallback) => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const normalizeRoles = (roles) => {
  const next = [];
  ensureArray(roles).forEach((role) => {
    const text = String(role || "").trim();
    if (!text) {
      return;
    }
    if (text.toLowerCase() === "dono") {
      return;
    }
    if (!next.includes(text)) {
      next.push(text);
    }
  });
  return next;
};

const normalizeLegacyPermissions = (permissions) => {
  const known = [];
  const unknown = [];
  let hadStar = false;
  ensureArray(permissions).forEach((permissionRaw) => {
    const permission = String(permissionRaw || "").trim().toLowerCase();
    if (!permission) {
      return;
    }
    if (permission === "*") {
      hadStar = true;
      PERMISSION_IDS.forEach((id) => {
        if (!known.includes(id)) {
          known.push(id);
        }
      });
      return;
    }
    if (permission === "usuarios") {
      ["usuarios_basico", "usuarios_acesso"].forEach((id) => {
        if (!known.includes(id)) {
          known.push(id);
        }
      });
      return;
    }
    if (PERMISSION_IDS.includes(permission)) {
      if (!known.includes(permission)) {
        known.push(permission);
      }
      return;
    }
    if (!unknown.includes(String(permissionRaw))) {
      unknown.push(String(permissionRaw));
    }
  });
  return {
    known,
    unknown,
    hadStar,
  };
};

const inferAccessRole = (user) => {
  const accessRole = String(user?.accessRole || "").trim().toLowerCase();
  if (ACCESS_ROLES.includes(accessRole)) {
    if (accessRole === "owner_primary" || accessRole === "owner_secondary") {
      return "normal";
    }
    return accessRole;
  }
  const permissions = ensureArray(user?.permissions).map((item) => String(item || "").trim().toLowerCase());
  if (permissions.includes("*") || permissions.includes("usuarios")) {
    return "admin";
  }
  const hasAdminBadge = ADMIN_BADGE_LEGACY_PERMISSIONS.every((permission) => permissions.includes(permission));
  if (hasAdminBadge) {
    return "admin";
  }
  return "normal";
};

const getOwnerIdsFromRoles = (users) =>
  users
    .filter((user) =>
      ensureArray(user?.roles).some((role) => String(role || "").trim().toLowerCase() === "dono"),
    )
    .map((user) => String(user?.id || "").trim())
    .filter(Boolean);

const ownersFirst = (ownerIds) => {
  const unique = [];
  ensureArray(ownerIds).forEach((id) => {
    const next = String(id || "").trim();
    if (!next) {
      return;
    }
    if (!unique.includes(next)) {
      unique.push(next);
    }
  });
  return unique;
};

const buildMigration = (usersInput, ownerIdsInput) => {
  const users = ensureArray(usersInput).map((user) => ({
    ...user,
    id: String(user?.id || "").trim(),
  }));
  const roleOwnerIds = getOwnerIdsFromRoles(users);
  const mergedOwnerIds = ownersFirst([...(ownerIdsInput || []), ...roleOwnerIds]);
  const primaryOwnerId = mergedOwnerIds[0] || null;
  const summary = {
    totalUsers: users.length,
    changedUsers: 0,
    expandedStars: 0,
    ownerRoleRemoved: 0,
    unknownPermissionsPreserved: 0,
    accessRoleAssigned: {
      normal: 0,
      admin: 0,
      owner_secondary: 0,
      owner_primary: 0,
    },
  };

  const nextUsers = users.map((user) => {
    const isPrimaryOwner = Boolean(primaryOwnerId && user.id === primaryOwnerId);
    const isSecondaryOwner = !isPrimaryOwner && mergedOwnerIds.includes(user.id);
    const previousRoles = ensureArray(user.roles);
    const normalizedRoles = normalizeRoles(previousRoles);
    if (normalizedRoles.length !== previousRoles.length) {
      summary.ownerRoleRemoved += 1;
    }
    const expanded = normalizeLegacyPermissions(user.permissions);
    if (expanded.hadStar) {
      summary.expandedStars += 1;
    }
    summary.unknownPermissionsPreserved += expanded.unknown.length;

    let nextAccessRole = inferAccessRole(user);
    if (isPrimaryOwner) {
      nextAccessRole = "owner_primary";
    } else if (isSecondaryOwner) {
      nextAccessRole = "owner_secondary";
    }

    let nextKnownPermissions = expanded.known;
    if (nextAccessRole === "owner_primary" || nextAccessRole === "owner_secondary") {
      nextKnownPermissions = [...PERMISSION_IDS];
    } else if (nextAccessRole === "admin" && nextKnownPermissions.length === 0) {
      nextKnownPermissions = [...DEFAULT_ADMIN_PERMISSIONS];
    }

    const nextPermissions = [...nextKnownPermissions, ...expanded.unknown];
    const nextUser = {
      ...user,
      roles: normalizedRoles,
      permissions: nextPermissions,
      accessRole: nextAccessRole,
    };

    summary.accessRoleAssigned[nextAccessRole] += 1;
    if (JSON.stringify(nextUser) !== JSON.stringify(user)) {
      summary.changedUsers += 1;
    }
    return nextUser;
  });

  const activeUserIds = new Set(nextUsers.map((user) => user.id).filter(Boolean));
  const filteredOwners = mergedOwnerIds.filter((ownerId) => activeUserIds.has(ownerId));
  const nextOwnerIds = ownersFirst(filteredOwners);

  return {
    nextUsers,
    nextOwnerIds,
    summary,
    previousOwnerIds: ownersFirst(ownerIdsInput || []),
  };
};

const appendAuditEntry = (summary, beforeOwnerIds, afterOwnerIds) => {
  const entries = ensureArray(readJson(auditLogFilePath, []));
  entries.push({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    actorId: "system",
    actorName: "RBAC V2 Migration",
    action: "users.permissions_v2_migrate",
    resource: "users",
    resourceId: "all",
    status: "success",
    ip: "127.0.0.1",
    requestId: `migration-${crypto.randomUUID()}`,
    meta: {
      dryRun: false,
      beforeOwnerIds,
      afterOwnerIds,
      summary,
    },
  });
  writeJson(auditLogFilePath, entries);
};

const users = readJson(usersFilePath, []);
const ownerIds = readJson(ownerIdsFilePath, []);
const migration = buildMigration(users, ownerIds);

console.log(JSON.stringify({
  dryRun,
  apply,
  summary: migration.summary,
  beforeOwnerIds: migration.previousOwnerIds,
  afterOwnerIds: migration.nextOwnerIds,
}, null, 2));

if (!apply) {
  process.exit(0);
}

const backupsDir = path.join(cwd, "backups");
const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupsDir, `users-rbac-v2-backup-${backupStamp}.json`);
fs.mkdirSync(backupsDir, { recursive: true });
writeJson(backupPath, users);

writeJson(usersFilePath, migration.nextUsers);
writeJson(ownerIdsFilePath, migration.nextOwnerIds);
appendAuditEntry(migration.summary, migration.previousOwnerIds, migration.nextOwnerIds);

console.log(`Applied RBAC V2 migration. Backup: ${backupPath}`);
