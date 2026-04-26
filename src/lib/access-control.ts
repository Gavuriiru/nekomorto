export const permissionIds = [
  "posts",
  "projetos",
  "comentarios",
  "paginas",
  "uploads",
  "analytics",
  "usuarios",
  "configuracoes",
  "audit_log",
  "integracoes",
] as const;

export type PermissionId = (typeof permissionIds)[number];

export const accessRoles = ["normal", "admin", "owner_secondary", "owner_primary"] as const;

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

export const isFrontendRbacV2Enabled = true;

const emptyGrantMap = (): GrantMap =>
  Object.fromEntries(permissionIds.map((permission) => [permission, false])) as GrantMap;

const coerceAccessRole = (value: string | undefined): AccessRole => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
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
  next.usuarios = grants.usuarios === true;
  return next;
};

export const resolveAccessRole = (user: AccessUserLike | null | undefined): AccessRole => {
  if (!user) {
    return "normal";
  }
  const userId = String(user.id || "");
  const ownerIds = Array.isArray(user.ownerIds) ? user.ownerIds.map((id) => String(id)) : [];
  const primaryOwnerId = user.primaryOwnerId
    ? String(user.primaryOwnerId)
    : String(ownerIds[0] || "");
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
  return coerceGrants(user.grants);
};

export const canGrant = (grants: GrantMap | null | undefined, permission: PermissionId): boolean =>
  Boolean(grants && grants[permission] === true);

const isOwnerRole = (accessRole: AccessRole | undefined): boolean =>
  accessRole === "owner_primary" || accessRole === "owner_secondary";

const resolveOptionsAccessRole = (accessRole?: AccessRole): AccessRole => accessRole || "normal";

export const canManagePostsAccess = (user: AccessUserLike | null | undefined): boolean => {
  const accessRole = resolveAccessRole(user);
  return isOwnerRole(accessRole) || canGrant(resolveGrants(user), "posts");
};

export const canManageProjectsAccess = (user: AccessUserLike | null | undefined): boolean => {
  const accessRole = resolveAccessRole(user);
  return isOwnerRole(accessRole) || canGrant(resolveGrants(user), "projetos");
};

export const canAccessUsersPage = (grants: GrantMap | null | undefined): boolean => {
  if (!grants) {
    return false;
  }
  return grants.usuarios === true;
};

type DashboardRouteRequirement = PermissionId | "users" | "owner" | null;

type DashboardAccessOptions = {
  accessRole?: AccessRole;
  allowUsersForSelf?: boolean;
};

const dashboardRouteToPermission: Record<string, DashboardRouteRequirement> = {
  "/dashboard": null,
  "/dashboard/seguranca": "owner",
  "/dashboard/analytics": "analytics",
  "/dashboard/posts": "posts",
  "/dashboard/projetos": "projetos",
  "/dashboard/comentarios": "comentarios",
  "/dashboard/uploads": "uploads",
  "/dashboard/audit-log": "audit_log",
  "/dashboard/usuarios": "users",
  "/dashboard/paginas": "paginas",
  "/dashboard/webhooks": "integracoes",
  "/dashboard/configuracoes": "configuracoes",
  "/dashboard/redirecionamentos": "configuracoes",
};

const dashboardRouteOrder = [
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/posts",
  "/dashboard/projetos",
  "/dashboard/comentarios",
  "/dashboard/uploads",
  "/dashboard/audit-log",
  "/dashboard/usuarios",
  "/dashboard/paginas",
  "/dashboard/webhooks",
  "/dashboard/configuracoes",
  "/dashboard/redirecionamentos",
  "/dashboard/seguranca",
] as const;

export const isDashboardHrefAllowed = (
  href: string,
  grants: GrantMap | null | undefined,
  { accessRole, allowUsersForSelf = false }: DashboardAccessOptions = {},
): boolean => {
  const required = dashboardRouteToPermission[href];
  if (required === undefined) {
    return true;
  }
  if (required === null) {
    return true;
  }
  if (required === "owner") {
    return isOwnerRole(resolveOptionsAccessRole(accessRole));
  }
  if (required === "users") {
    if (!grants) {
      return false;
    }
    return canAccessUsersPage(grants) || allowUsersForSelf;
  }
  return canGrant(grants, required);
};

export const getDashboardRouteRequirement = (pathname: string): DashboardRouteRequirement => {
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
  options: DashboardAccessOptions = {},
): boolean => {
  const required = getDashboardRouteRequirement(pathname);
  if (required === null) {
    return true;
  }
  if (required === "owner") {
    return isOwnerRole(resolveOptionsAccessRole(options.accessRole));
  }
  if (required === "users") {
    return Boolean(options.allowUsersForSelf || canAccessUsersPage(grants));
  }
  return canGrant(grants, required);
};

export const getFirstAllowedDashboardRoute = (
  grants: GrantMap | null | undefined,
  options: DashboardAccessOptions = {},
): string => {
  const allowed =
    dashboardRouteOrder.find((href) =>
      isDashboardHrefAllowed(href, grants, {
        accessRole: options.accessRole,
        allowUsersForSelf: options.allowUsersForSelf ?? false,
      }),
    ) || "/dashboard";
  return allowed;
};

export const buildDashboardMenuFromGrants = <T extends { href: string; enabled: boolean }>(
  items: T[],
  grants: GrantMap | null | undefined,
  options: DashboardAccessOptions = {},
): T[] =>
  items
    .map((item) => ({
      ...item,
      enabled: isDashboardHrefAllowed(item.href, grants, {
        accessRole: options.accessRole,
        allowUsersForSelf: options.allowUsersForSelf ?? false,
      }),
    }))
    .filter((item) => item.enabled);
