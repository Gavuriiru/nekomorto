const freeze = (value) => Object.freeze(value);

export const AccessRole = freeze({
  NORMAL: "normal",
  ADMIN: "admin",
  OWNER_SECONDARY: "owner_secondary",
  OWNER_PRIMARY: "owner_primary",
});

export const ACCESS_ROLE_IDS = freeze([
  AccessRole.NORMAL,
  AccessRole.ADMIN,
  AccessRole.OWNER_SECONDARY,
  AccessRole.OWNER_PRIMARY,
]);

export const PermissionId = freeze({
  POSTS: "posts",
  PROJETOS: "projetos",
  COMENTARIOS: "comentarios",
  PAGINAS: "paginas",
  UPLOADS: "uploads",
  ANALYTICS: "analytics",
  USUARIOS_BASICO: "usuarios_basico",
  USUARIOS_ACESSO: "usuarios_acesso",
  CONFIGURACOES: "configuracoes",
  AUDIT_LOG: "audit_log",
  INTEGRACOES: "integracoes",
});

export const PERMISSION_IDS = freeze([
  PermissionId.POSTS,
  PermissionId.PROJETOS,
  PermissionId.COMENTARIOS,
  PermissionId.PAGINAS,
  PermissionId.UPLOADS,
  PermissionId.ANALYTICS,
  PermissionId.USUARIOS_BASICO,
  PermissionId.USUARIOS_ACESSO,
  PermissionId.CONFIGURACOES,
  PermissionId.AUDIT_LOG,
  PermissionId.INTEGRACOES,
]);

const KNOWN_PERMISSION_SET = new Set(PERMISSION_IDS);
const KNOWN_ACCESS_ROLE_SET = new Set(ACCESS_ROLE_IDS);

const DEFAULT_ADMIN_PERMISSIONS = freeze([
  PermissionId.POSTS,
  PermissionId.PROJETOS,
  PermissionId.COMENTARIOS,
  PermissionId.PAGINAS,
  PermissionId.UPLOADS,
  PermissionId.ANALYTICS,
  PermissionId.USUARIOS_BASICO,
]);

const DEFAULT_PERMISSIONS_BY_ROLE = freeze({
  [AccessRole.NORMAL]: freeze([]),
  [AccessRole.ADMIN]: DEFAULT_ADMIN_PERMISSIONS,
  [AccessRole.OWNER_SECONDARY]: PERMISSION_IDS,
  [AccessRole.OWNER_PRIMARY]: PERMISSION_IDS,
});

const LEGACY_PERMISSION_ALIASES = freeze({
  usuarios: [PermissionId.USUARIOS_BASICO, PermissionId.USUARIOS_ACESSO],
});

export const BASIC_PROFILE_FIELDS = freeze([
  "name",
  "phrase",
  "bio",
  "avatarUrl",
  "avatarDisplay",
  "socials",
]);

const addUnique = (target, value) => {
  if (!value) {
    return;
  }
  if (!target.includes(value)) {
    target.push(value);
  }
};

export const normalizeAccessRole = (value, fallback = AccessRole.NORMAL) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (KNOWN_ACCESS_ROLE_SET.has(normalized)) {
    return normalized;
  }
  return fallback;
};

export const isOwnerAccessRole = (value) => {
  const role = normalizeAccessRole(value, AccessRole.NORMAL);
  return role === AccessRole.OWNER_PRIMARY || role === AccessRole.OWNER_SECONDARY;
};

export const defaultPermissionsForRole = (accessRole) => {
  const role = normalizeAccessRole(accessRole, AccessRole.NORMAL);
  return [...(DEFAULT_PERMISSIONS_BY_ROLE[role] || [])];
};

export const expandLegacyPermissions = (
  permissions,
  { acceptLegacyStar = true, keepUnknown = true } = {},
) => {
  const input = Array.isArray(permissions) ? permissions : [];
  const knownPermissions = [];
  const unknownPermissions = [];
  let hadLegacyStar = false;

  input.forEach((permissionRaw) => {
    const permission = String(permissionRaw || "").trim().toLowerCase();
    if (!permission) {
      return;
    }
    if (permission === "*") {
      hadLegacyStar = true;
      if (acceptLegacyStar) {
        PERMISSION_IDS.forEach((id) => addUnique(knownPermissions, id));
      } else if (keepUnknown) {
        addUnique(unknownPermissions, permissionRaw);
      }
      return;
    }
    if (KNOWN_PERMISSION_SET.has(permission)) {
      addUnique(knownPermissions, permission);
      return;
    }
    const aliases = LEGACY_PERMISSION_ALIASES[permission];
    if (Array.isArray(aliases) && aliases.length > 0) {
      aliases.forEach((alias) => addUnique(knownPermissions, alias));
      return;
    }
    if (keepUnknown) {
      addUnique(unknownPermissions, String(permissionRaw));
    }
  });

  return {
    knownPermissions,
    unknownPermissions,
    hadLegacyStar,
  };
};

export const computeEffectiveAccessRole = ({
  userId,
  accessRole,
  ownerIds,
  primaryOwnerId,
} = {}) => {
  const normalizedUserId = String(userId || "");
  const owners = Array.isArray(ownerIds) ? ownerIds.map((id) => String(id)) : [];
  const primary = primaryOwnerId ? String(primaryOwnerId) : String(owners[0] || "");
  if (primary && normalizedUserId && normalizedUserId === primary) {
    return AccessRole.OWNER_PRIMARY;
  }
  if (normalizedUserId && owners.includes(normalizedUserId)) {
    return AccessRole.OWNER_SECONDARY;
  }
  return normalizeAccessRole(accessRole, AccessRole.NORMAL);
};

const buildEmptyGrants = () =>
  Object.fromEntries(PERMISSION_IDS.map((permissionId) => [permissionId, false]));

export const computeGrants = ({
  userId,
  accessRole,
  permissions,
  ownerIds,
  primaryOwnerId,
  acceptLegacyStar = true,
} = {}) => {
  const effectiveAccessRole = computeEffectiveAccessRole({
    userId,
    accessRole,
    ownerIds,
    primaryOwnerId,
  });
  if (effectiveAccessRole === AccessRole.OWNER_PRIMARY) {
    return Object.fromEntries(PERMISSION_IDS.map((permissionId) => [permissionId, true]));
  }

  const explicitPermissions = Array.isArray(permissions)
    ? expandLegacyPermissions(permissions, {
        acceptLegacyStar,
        keepUnknown: false,
      }).knownPermissions
    : null;
  const basePermissions =
    explicitPermissions !== null ? explicitPermissions : defaultPermissionsForRole(effectiveAccessRole);

  const grants = buildEmptyGrants();
  basePermissions.forEach((permissionId) => {
    if (KNOWN_PERMISSION_SET.has(permissionId)) {
      grants[permissionId] = true;
    }
  });
  return grants;
};

export const can = ({ grants, permissionId }) => {
  if (!permissionId || typeof permissionId !== "string") {
    return false;
  }
  return Boolean(grants && grants[permissionId] === true);
};

export const sanitizePermissionsForStorage = (
  permissions,
  {
    acceptLegacyStar = true,
    keepUnknown = true,
  } = {},
) => {
  const expanded = expandLegacyPermissions(permissions, {
    acceptLegacyStar,
    keepUnknown,
  });
  if (!keepUnknown) {
    return [...expanded.knownPermissions];
  }
  return [...expanded.knownPermissions, ...expanded.unknownPermissions];
};

export const removeOwnerRoleLabel = (roles) => {
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles.filter((role) => String(role || "").trim().toLowerCase() !== "dono");
};

export const addOwnerRoleLabel = (roles, isOwner) => {
  const normalized = removeOwnerRoleLabel(roles);
  if (!isOwner) {
    return normalized;
  }
  return ["Dono", ...normalized];
};

export const isBasicProfileField = (field) => BASIC_PROFILE_FIELDS.includes(String(field || ""));

export const pickBasicProfilePatch = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};
  BASIC_PROFILE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      next[field] = source[field];
    }
  });
  return next;
};

export const isTruthyEnv = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

