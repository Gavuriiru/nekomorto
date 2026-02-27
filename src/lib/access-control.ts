export const permissionIds = [
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
] as const;

export type PermissionId = (typeof permissionIds)[number];

export const accessRoles = [
  "normal",
  "admin",
  "owner_secondary",
  "owner_primary",
] as const;

export type AccessRole = (typeof accessRoles)[number];
export type GrantMap = Record<PermissionId, boolean>;

export type AccessUserLike = {
  id?: string;
  accessRole?: string;
  permissions?: string[];
  grants?: Partial<Record<string, boolean>>;
  ownerIds?: string[];
  primaryOwnerId?: string | null;
};

export const isFrontendRbacV2Enabled = (() => {
  const raw = String(import.meta.env.VITE_RBAC_V2_ENABLED || "").trim().toLowerCase();
  if (!raw) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(raw);
})();

const toPermissionSet = (permissions: string[] | undefined | null) => {
  const set = new Set<string>();
  (Array.isArray(permissions) ? permissions : []).forEach((permission) => {
    const normalized = String(permission || "").trim().toLowerCase();
    if (!normalized) {
      return;
    }
    if (normalized === "*") {
      permissionIds.forEach((id) => set.add(id));
      return;
    }
    if (normalized === "usuarios") {
      set.add("usuarios_basico");
      set.add("usuarios_acesso");
      return;
    }
    set.add(normalized);
  });
  return set;
};

const emptyGrantMap = (): GrantMap =>
  Object.fromEntries(permissionIds.map((permission) => [permission, false])) as GrantMap;

const coerceAccessRole = (value: string | undefined): AccessRole => {
  const normalized = String(value || "").trim().toLowerCase();
  if ((accessRoles as readonly string[]).includes(normalized)) {
    return normalized as AccessRole;
  }
  return "normal";
};

const coerceGrants = (grants: AccessUserLike["grants"]): GrantMap => {
  const next = emptyGrantMap();
  if (!grants || typeof grants !== "object") {
    return next;
  }
  permissionIds.forEach((permission) => {
    next[permission] = grants[permission] === true;
  });
  return next;
};

const computeLegacyGrants = (user: AccessUserLike | null | undefined): GrantMap => {
  const next = emptyGrantMap();
  if (!user) {
    return next;
  }
  const userId = String(user.id || "");
  const ownerIds = Array.isArray(user.ownerIds) ? user.ownerIds.map((id) => String(id)) : [];
  if (ownerIds.includes(userId)) {
    permissionIds.forEach((permission) => {
      next[permission] = true;
    });
    return next;
  }
  const permissions = toPermissionSet(user.permissions);
  const has = (permission: string) => permissions.has(permission);
  next.posts = has("posts");
  next.projetos = has("projetos");
  next.comentarios = has("comentarios") || has("posts") || has("projetos");
  next.paginas = has("paginas");
  next.uploads = has("uploads") || has("posts") || has("projetos") || has("configuracoes");
  next.analytics = has("analytics") || has("posts") || has("projetos") || has("comentarios");
  next.usuarios_basico = has("usuarios_basico") || has("usuarios");
  next.usuarios_acesso = has("usuarios_acesso") || has("usuarios");
  next.configuracoes = has("configuracoes");
  next.audit_log = ownerIds.includes(userId);
  next.integracoes = has("integracoes") || has("configuracoes") || has("projetos");
  return next;
};

export const resolveAccessRole = (user: AccessUserLike | null | undefined): AccessRole => {
  if (!user) {
    return "normal";
  }
  const userId = String(user.id || "");
  const ownerIds = Array.isArray(user.ownerIds) ? user.ownerIds.map((id) => String(id)) : [];
  const primaryOwnerId = user.primaryOwnerId ? String(user.primaryOwnerId) : String(ownerIds[0] || "");
  if (primaryOwnerId && userId === primaryOwnerId) {
    return "owner_primary";
  }
  if (ownerIds.includes(userId)) {
    return "owner_secondary";
  }
  return coerceAccessRole(user.accessRole);
};

export const resolveGrants = (user: AccessUserLike | null | undefined): GrantMap => {
  if (!user) {
    return emptyGrantMap();
  }
  if (isFrontendRbacV2Enabled) {
    return coerceGrants(user.grants);
  }
  return computeLegacyGrants(user);
};

export const canGrant = (grants: GrantMap | null | undefined, permission: PermissionId): boolean =>
  Boolean(grants && grants[permission] === true);

export const canAccessUsersPage = (grants: GrantMap | null | undefined): boolean => {
  if (!grants) {
    return false;
  }
  return grants.usuarios_basico || grants.usuarios_acesso;
};

const dashboardRouteToPermission: Record<string, PermissionId | "users" | null> = {
  "/dashboard": null,
  "/dashboard/seguranca": null,
  "/dashboard/analytics": "analytics",
  "/dashboard/posts": "posts",
  "/dashboard/projetos": "projetos",
  "/dashboard/comentarios": "comentarios",
  "/dashboard/audit-log": "audit_log",
  "/dashboard/usuarios": "users",
  "/dashboard/paginas": "paginas",
  "/dashboard/webhooks": "integracoes",
  "/dashboard/configuracoes": "configuracoes",
};

const dashboardRouteOrder = [
  "/dashboard",
  "/dashboard/seguranca",
  "/dashboard/analytics",
  "/dashboard/posts",
  "/dashboard/projetos",
  "/dashboard/comentarios",
  "/dashboard/audit-log",
  "/dashboard/usuarios",
  "/dashboard/paginas",
  "/dashboard/webhooks",
  "/dashboard/configuracoes",
] as const;

export const isDashboardHrefAllowed = (
  href: string,
  grants: GrantMap | null | undefined,
  {
    allowUsersForSelf = false,
  }: {
    allowUsersForSelf?: boolean;
  } = {},
): boolean => {
  if (!isFrontendRbacV2Enabled) {
    return true;
  }
  const required = dashboardRouteToPermission[href];
  if (required === undefined) {
    return true;
  }
  if (required === null) {
    return true;
  }
  if (required === "users") {
    if (!grants) {
      return false;
    }
    return canAccessUsersPage(grants) || allowUsersForSelf;
  }
  return canGrant(grants, required);
};

export const getDashboardRouteRequirement = (pathname: string): PermissionId | "users" | null => {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const route = Object.keys(dashboardRouteToPermission).find((href) => {
    if (href === normalized) {
      return true;
    }
    if (href !== "/dashboard" && normalized.startsWith(`${href}/`)) {
      return true;
    }
    return false;
  });
  if (!route) {
    return null;
  }
  return dashboardRouteToPermission[route] ?? null;
};

export const isDashboardPathAllowed = (
  pathname: string,
  grants: GrantMap | null | undefined,
  options?: { allowUsersForSelf?: boolean },
): boolean => {
  if (!isFrontendRbacV2Enabled) {
    return true;
  }
  const required = getDashboardRouteRequirement(pathname);
  if (required === null) {
    return true;
  }
  if (required === "users") {
    return Boolean(options?.allowUsersForSelf || canAccessUsersPage(grants));
  }
  return canGrant(grants, required);
};

export const getFirstAllowedDashboardRoute = (
  grants: GrantMap | null | undefined,
  options?: { allowUsersForSelf?: boolean },
): string => {
  if (!isFrontendRbacV2Enabled) {
    return "/dashboard";
  }
  const allowed =
    dashboardRouteOrder.find((href) =>
      isDashboardHrefAllowed(href, grants, { allowUsersForSelf: options?.allowUsersForSelf ?? false }),
    ) || "/dashboard";
  return allowed;
};

export const buildDashboardMenuFromGrants = <T extends { href: string; enabled: boolean }>(
  items: T[],
  grants: GrantMap | null | undefined,
  options?: { allowUsersForSelf?: boolean },
): T[] =>
  items
    .map((item) => ({
      ...item,
      enabled: isDashboardHrefAllowed(item.href, grants, {
        allowUsersForSelf: options?.allowUsersForSelf ?? false,
      }),
    }))
    .filter((item) => item.enabled);
