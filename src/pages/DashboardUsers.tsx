import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import AsyncState from "@/components/ui/async-state";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  UserRound,
  BadgeCheck,
  Check,
  Clock,
  Code,
  Globe,
  Instagram,
  Languages,
  Layers,
  Paintbrush,
  Palette,
  PenTool,
  Sparkles,
  Video,
  X,
  Youtube,
  MessageCircle,
  GripVertical,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useEditorScrollLock } from "@/hooks/use-editor-scroll-lock";
import { useEditorScrollStability } from "@/hooks/use-editor-scroll-stability";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { toast } from "@/components/ui/use-toast";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { type AccessRole, permissionIds } from "@/lib/access-control";

const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

type UserRecord = {
  id: string;
  name: string;
  phrase: string;
  bio: string;
  avatarUrl?: string | null;
  socials?: Array<{ label: string; href: string }>;
  status: "active" | "retired";
  permissions: string[];
  roles?: string[];
  accessRole?: AccessRole;
  grants?: Partial<Record<string, boolean>>;
  order: number;
};

type DashboardAvatarProps = {
  avatarUrl?: string | null;
  name: string;
  sizeClassName: string;
  frameClassName: string;
  fallbackClassName: string;
  fallbackText: string;
};

const DashboardAvatar = ({
  avatarUrl,
  name,
  sizeClassName,
  frameClassName,
  fallbackClassName,
  fallbackText,
}: DashboardAvatarProps) => {
  const [hasError, setHasError] = useState(false);
  const hasImage = Boolean(avatarUrl) && !hasError;

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  if (!hasImage) {
    return <div className={fallbackClassName}>{fallbackText}</div>;
  }

  return (
    <div className={`${sizeClassName} ${frameClassName} relative shrink-0 overflow-hidden rounded-full`}>
      <img
        src={String(avatarUrl)}
        alt={name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const emptyForm = {
  id: "",
  name: "",
  phrase: "",
  bio: "",
  avatarUrl: "",
  socials: [] as Array<{ label: string; href: string }>,
  status: "active" as "active" | "retired",
  accessRole: "normal" as AccessRole,
  permissions: [] as string[],
  roles: [] as string[],
};

const permissionOptions: Array<{ id: (typeof permissionIds)[number]; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "projetos", label: "Projetos" },
  { id: "comentarios", label: "Comentários" },
  { id: "paginas", label: "Páginas" },
  { id: "uploads", label: "Uploads" },
  { id: "analytics", label: "Analytics" },
  { id: "usuarios_basico", label: "Usuários (básico)" },
  { id: "usuarios_acesso", label: "Usuários (acesso)" },
  { id: "configuracoes", label: "Configurações" },
  { id: "audit_log", label: "Audit Log" },
  { id: "integracoes", label: "Integrações" },
];

const stripOwnerRole = (roles: string[]) =>
  roles.filter((role) => role.trim().toLowerCase() !== "dono");

const accessRoleOptions: Array<{ id: AccessRole; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "admin", label: "Admin" },
];

const defaultRoleOptions = [
  "Tradutor",
  "Revisor",
  "Typesetter",
  "Qualidade",
  "Desenvolvedor",
  "Cleaner",
  "Redrawer",
  "Encoder",
  "K-Timer",
  "Logo Maker",
  "K-Maker",
];

const socialIconMap: Record<string, typeof Globe> = {
  instagram: Instagram,
  twitter: X,
  x: X,
  youtube: Youtube,
  discord: MessageCircle,
  "message-circle": MessageCircle,
  globe: Globe,
  site: Globe,
};

const isIconUrl = (value?: string | null) => {
  if (!value) return false;
  return value.startsWith("http") || value.startsWith("data:") || value.startsWith("/uploads/");
};

const addAvatarCacheBust = (avatarUrl: string | null | undefined, cacheVersion: number) => {
  const trimmed = String(avatarUrl || "").trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/uploads/")) {
    const parsed = new URL(trimmed, "http://localhost");
    parsed.searchParams.set("v", String(cacheVersion));
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.startsWith("/uploads/")) {
      return trimmed;
    }
    parsed.searchParams.set("v", String(cacheVersion));
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

const reorderItems = <T,>(items: T[], from: number, to: number) => {
  if (from === to) {
    return items;
  }
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  next.splice(to, 0, moved);
  return next;
};

const getOrderedUserBuckets = (items: UserRecord[]) => {
  const activeIds = items
    .filter((user) => user.status === "active")
    .sort((a, b) => a.order - b.order)
    .map((user) => user.id);
  const retiredIds = items
    .filter((user) => user.status === "retired")
    .sort((a, b) => a.order - b.order)
    .map((user) => user.id);
  return { activeIds, retiredIds };
};

const didUserOrderChange = (before: UserRecord[], after: UserRecord[]) => {
  const beforeBuckets = getOrderedUserBuckets(before);
  const afterBuckets = getOrderedUserBuckets(after);
  if (beforeBuckets.activeIds.length !== afterBuckets.activeIds.length) {
    return true;
  }
  if (beforeBuckets.retiredIds.length !== afterBuckets.retiredIds.length) {
    return true;
  }
  const activeChanged = beforeBuckets.activeIds.some((id, index) => id !== afterBuckets.activeIds[index]);
  if (activeChanged) {
    return true;
  }
  return beforeBuckets.retiredIds.some((id, index) => id !== afterBuckets.retiredIds[index]);
};

const roleIconRegistry: Record<string, typeof Globe> = {
  languages: Languages,
  check: Check,
  "pen-tool": PenTool,
  sparkles: Sparkles,
  code: Code,
  paintbrush: Paintbrush,
  layers: Layers,
  video: Video,
  clock: Clock,
  badge: BadgeCheck,
  palette: Palette,
  user: UserRound,
};

const DashboardUsers = () => {
  usePageMeta({ title: "Usuários", noIndex: true });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const roleOptions = useMemo(() => {
    const labels = settings.teamRoles.map((role) => role.label).filter(Boolean);
    return labels.length ? labels : defaultRoleOptions;
  }, [settings.teamRoles]);
  const roleIconMap = useMemo(
    () => new Map(settings.teamRoles.map((role) => [role.label, role.icon])),
    [settings.teamRoles],
  );
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
    accessRole?: AccessRole;
    grants?: Partial<Record<string, boolean>>;
    permissions?: string[];
    ownerIds?: string[];
    primaryOwnerId?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<"active" | "retired" | null>(null);
  const [dragUsersSnapshot, setDragUsersSnapshot] = useState<UserRecord[] | null>(null);
  const [socialDragIndex, setSocialDragIndex] = useState<number | null>(null);
  const [socialDragOverIndex, setSocialDragOverIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  useEditorScrollLock(isDialogOpen);
  useEditorScrollStability(isDialogOpen);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState(emptyForm);
  const [ownerToggle, setOwnerToggle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [avatarCacheVersion, setAvatarCacheVersion] = useState(0);
  const [linkTypes, setLinkTypes] = useState<Array<{ id: string; label: string; icon: string }>>([]);
  const fallbackLinkTypes = useMemo(
    () => [
      { id: "instagram", label: "Instagram", icon: "instagram" },
      { id: "x", label: "X", icon: "x" },
      { id: "youtube", label: "YouTube", icon: "youtube" },
      { id: "discord", label: "Discord", icon: "message-circle" },
      { id: "site", label: "Site", icon: "globe" },
    ],
    [],
  );
  const avatarLibraryFolders = useMemo(() => ["users"], []);
  const primaryOwnerId = useMemo(
    () => String(currentUser?.primaryOwnerId || ownerIds[0] || ""),
    [currentUser?.primaryOwnerId, ownerIds],
  );
  const resolveUserAccessRole = useCallback(
    (user: UserRecord | null | undefined): AccessRole => {
      if (!user) {
        return "normal";
      }
      if (user.id === primaryOwnerId) {
        return "owner_primary";
      }
      if (ownerIds.includes(user.id)) {
        return "owner_secondary";
      }
      return user.accessRole === "admin" ? "admin" : "normal";
    },
    [ownerIds, primaryOwnerId],
  );
  const actorAccessRole: AccessRole = useMemo(() => {
    if (!currentUser) {
      return "normal";
    }
    if (currentUser.id === primaryOwnerId) {
      return "owner_primary";
    }
    if (ownerIds.includes(currentUser.id)) {
      return "owner_secondary";
    }
    return currentUser.accessRole === "admin" ? "admin" : "normal";
  }, [currentUser, ownerIds, primaryOwnerId]);
  const isPrimaryOwnerActor = actorAccessRole === "owner_primary";
  const isSecondaryOwnerActor = actorAccessRole === "owner_secondary";
  const isAdminActor = actorAccessRole === "admin";
  const actorCanUsersBasic = currentUser?.grants?.usuarios_basico === true;
  const actorCanUsersAccess = currentUser?.grants?.usuarios_acesso === true;
  const canManageUsers = (isPrimaryOwnerActor || isSecondaryOwnerActor) && actorCanUsersAccess;
  const canManageOwners = isPrimaryOwnerActor;
  const isOwnerUser = useCallback((user: UserRecord | null | undefined) => {
    if (!user) {
      return false;
    }
    return ownerIds.includes(user.id);
  }, [ownerIds]);
  const currentUserRecord = currentUser
    ? users.find((user) => user.id === currentUser.id) || null
    : null;
  const clearSocialDragState = useCallback(() => {
    setSocialDragIndex(null);
    setSocialDragOverIndex(null);
  }, []);
  const bumpAvatarCacheVersion = useCallback(() => {
    setAvatarCacheVersion((prev) => prev + 1);
  }, []);
  const toAvatarRenderUrl = useCallback(
    (avatarUrl: string | null | undefined) => addAvatarCacheBust(avatarUrl, avatarCacheVersion),
    [avatarCacheVersion],
  );
  const handleLibraryOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsLibraryOpen(nextOpen);
      if (!nextOpen) {
        bumpAvatarCacheVersion();
      }
    },
    [bumpAvatarCacheVersion],
  );
  const openLibrary = () => {
    setIsLibraryOpen(true);
  };
  const handleLibrarySave = useCallback(({ urls }: { urls: string[] }) => {
    const url = urls[0] || "";
    setFormState((prev) => ({
      ...prev,
      avatarUrl: url,
    }));
  }, []);
  const openEditDialog = useCallback((user: UserRecord) => {
    const normalizedPermissions = Array.from(
      new Set(
        (Array.isArray(user.permissions) ? user.permissions : [])
          .map((permission) => String(permission || "").trim())
          .filter((permission) => permissionOptions.some((option) => option.id === permission)),
      ),
    ) as Array<(typeof permissionIds)[number]>;
    const normalizedRoles = stripOwnerRole(Array.isArray(user.roles) ? user.roles : []);
    const userAccessRole = resolveUserAccessRole(user);
    setEditingUser(user);
    setFormState({
      id: user.id,
      name: user.name,
      phrase: user.phrase,
      bio: user.bio,
      avatarUrl: user.avatarUrl || "",
      socials: user.socials ? [...user.socials] : [],
      status: user.status,
      accessRole:
        userAccessRole === "admin"
          ? "admin"
          : "normal",
      permissions: normalizedPermissions,
      roles: normalizedRoles ? [...normalizedRoles] : [],
    });
    setOwnerToggle(isOwnerUser(user));
    clearSocialDragState();
    setIsDialogOpen(true);
  }, [clearSocialDragState, isOwnerUser, resolveUserAccessRole]);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === "active").sort((a, b) => a.order - b.order),
    [users],
  );
  const retiredUsers = useMemo(
    () => users.filter((user) => user.status === "retired").sort((a, b) => a.order - b.order),
    [users],
  );
  const isOwnerRecord = editingUser ? isOwnerUser(editingUser) : false;
  const isPrimaryOwnerRecord = editingUser ? editingUser.id === primaryOwnerId : false;
  const effectivePermissions = useMemo(() => {
    return Array.from(new Set(formState.permissions)) as Array<(typeof permissionIds)[number]>;
  }, [formState.permissions]);
  const isAdminRecord = (user: UserRecord) => resolveUserAccessRole(user) === "admin";
  const isAdminForm = formState.accessRole === "admin";
  const isEditingSelf = Boolean(editingUser && currentUser && editingUser.id === currentUser.id);
  const canCreateUsers = canManageUsers;
  const canEditBasicFields = !editingUser
    ? canCreateUsers
    : isEditingSelf ||
      (actorCanUsersBasic &&
        (isPrimaryOwnerActor || (isSecondaryOwnerActor && !isOwnerRecord) || (isAdminActor && !isOwnerRecord)));
  const canEditRoles = !editingUser
    ? canCreateUsers
    : actorCanUsersAccess && (isPrimaryOwnerActor || (isSecondaryOwnerActor && !isOwnerRecord));
  const canEditAccessControls = !editingUser
    ? canCreateUsers
    : actorCanUsersAccess && (isPrimaryOwnerActor || (isSecondaryOwnerActor && !isOwnerRecord));
  const canEditStatus = canEditAccessControls && !isEditingSelf && !isPrimaryOwnerRecord;
  const basicProfileOnlyEdit = Boolean(editingUser && canEditBasicFields && !canEditAccessControls);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setHasLoadError(false);
        const [usersRes, meRes, linkTypesRes] = await Promise.all([
          apiFetch(apiBase, "/api/users", { auth: true }),
          apiFetch(apiBase, "/api/me", { auth: true }),
          apiFetch(apiBase, "/api/link-types"),
        ]);

        if (!usersRes.ok) {
          throw new Error("users_load_failed");
        }
        const data = await usersRes.json();
        setUsers(data.users || []);
        setOwnerIds(Array.isArray(data.ownerIds) ? data.ownerIds : []);

        if (meRes.ok) {
          const me = await meRes.json();
          setCurrentUser(me);
        } else {
          setCurrentUser(null);
        }

        if (linkTypesRes.ok) {
          const linkTypePayload = await linkTypesRes.json();
          setLinkTypes(Array.isArray(linkTypePayload.items) ? linkTypePayload.items : []);
        } else {
          setLinkTypes([]);
        }
      } catch {
        setUsers([]);
        setOwnerIds([]);
        setHasLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [apiBase, loadVersion]);

  useEffect(() => {
    if (searchParams.get("edit") !== "me") {
      return;
    }
    if (!currentUserRecord || isDialogOpen) {
      return;
    }
    openEditDialog(currentUserRecord);
    navigate("/dashboard/usuarios", { replace: true });
  }, [currentUserRecord, isDialogOpen, navigate, openEditDialog, searchParams]);

  const openNewDialog = () => {
    setEditingUser(null);
    setFormState({ ...emptyForm, accessRole: "normal", permissions: [] });
    setOwnerToggle(false);
    clearSocialDragState();
    setIsDialogOpen(true);
  };

  const canOpenEdit = (user: UserRecord) => {
    if (!currentUser) {
      return false;
    }
    if (currentUser.id === user.id) {
      return true;
    }
    if (!actorCanUsersBasic) {
      return false;
    }
    if (isPrimaryOwnerActor) {
      return true;
    }
    if (isSecondaryOwnerActor) {
      return !isOwnerUser(user);
    }
    if (isAdminActor) {
      return !isOwnerUser(user);
    }
    return false;
  };

  const handleUserCardClick = (user: UserRecord) => {
    if (!canOpenEdit(user)) {
      return;
    }
    openEditDialog(user);
  };

  const handleSave = async () => {
    if (!canEditBasicFields) {
      return;
    }
    const normalizedPermissions = Array.from(new Set(formState.permissions));
    const normalizedAccessRole: AccessRole = ownerToggle
      ? "owner_secondary"
      : formState.accessRole === "admin"
        ? "admin"
        : "normal";
    const basePayload = {
      id: formState.id.trim(),
      name: formState.name.trim(),
      phrase: formState.phrase.trim(),
      bio: formState.bio.trim(),
      avatarUrl: formState.avatarUrl.trim() || null,
      socials: formState.socials.filter((item) => item.label.trim() && item.href.trim()),
      roles: stripOwnerRole(formState.roles),
      accessRole: normalizedAccessRole,
      status: canEditStatus ? formState.status : "active",
      permissions: canEditAccessControls ? normalizedPermissions : [],
    };
    const payload = (() => {
      if (!editingUser) {
        return basePayload;
      }
      if (canEditAccessControls) {
        return basePayload;
      }
      return {
        name: basePayload.name,
        phrase: basePayload.phrase,
        bio: basePayload.bio,
        avatarUrl: basePayload.avatarUrl,
        socials: basePayload.socials,
      };
    })();

    if (!editingUser && (!basePayload.id || !basePayload.name)) {
      return;
    }

    const method = editingUser ? "PUT" : "POST";
    const canUseUsersByIdEndpoint = isPrimaryOwnerActor || isSecondaryOwnerActor || isAdminActor;
    const path = editingUser
      ? canUseUsersByIdEndpoint
        ? `/api/users/${editingUser.id}`
        : "/api/users/self"
      : "/api/users";

    const response = await apiFetch(apiBase, path, {
      method,
      auth: true,
      json: payload,
    });

    if (response.ok) {
      const data = await response.json();
      const targetId = editingUser ? editingUser.id : data.user?.id || basePayload.id;
      const wasOwner = Boolean(editingUser && ownerIds.includes(editingUser.id));
      const shouldKeepOwner = Boolean(ownerToggle);
      if (canManageOwners && targetId) {
        const nextOwnerIds = shouldKeepOwner
          ? Array.from(new Set([...ownerIds, targetId]))
          : ownerIds.filter((id) => id !== targetId);
        if (nextOwnerIds.join(",") !== ownerIds.join(",")) {
          const ownersResponse = await apiFetch(apiBase, "/api/owners", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            auth: true,
            body: JSON.stringify({ ownerIds: nextOwnerIds }),
          });
          if (ownersResponse.ok) {
            const ownersData = await ownersResponse.json();
            setOwnerIds(Array.isArray(ownersData.ownerIds) ? ownersData.ownerIds : nextOwnerIds);
            if (!shouldKeepOwner) {
              setOwnerToggle(false);
            }
          } else {
            toast({
              title: shouldKeepOwner ? "Não foi possível promover para dono" : "Não foi possível rebaixar o dono",
              variant: "destructive",
            });
          }
        }
      }
      if (editingUser) {
        setUsers((prev) => prev.map((user) => (user.id === editingUser.id ? data.user : user)));
      } else {
        setUsers((prev) => [...prev, data.user]);
      }
      if (wasOwner && !shouldKeepOwner) {
        setFormState((prev) => ({
          ...prev,
          accessRole: "normal",
        }));
      }
      bumpAvatarCacheVersion();
      setIsDialogOpen(false);
      toast({
        title: editingUser ? "Usuário atualizado" : "Usuário criado",
        description: "As alterações foram salvas com sucesso.",
        intent: "success",
      });
      return;
    }
    toast({ title: "Não foi possível salvar o usuário", variant: "destructive" });
  };

  const togglePermission = (permissionId: (typeof permissionIds)[number]) => {
    if (!canEditAccessControls) {
      return;
    }
    setFormState((prev) => {
      const basePermissions = prev.permissions;
      const hasPermission = basePermissions.includes(permissionId);
      return {
        ...prev,
        permissions: hasPermission
          ? basePermissions.filter((item) => item !== permissionId)
          : [...basePermissions, permissionId],
      };
    });
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) {
      return;
    }
    const response = await apiFetch(apiBase, `/api/users/${deleteTarget.id}`, {
      method: "DELETE",
      auth: true,
    });
    if (!response.ok) {
      toast({ title: "Não foi possível excluir o usuário", variant: "destructive" });
      return;
    }
    const data = await response.json();
    setUsers((prev) => prev.filter((user) => user.id !== deleteTarget.id));
    if (Array.isArray(data.ownerIds)) {
      setOwnerIds(data.ownerIds);
    }
    if (editingUser && editingUser.id === deleteTarget.id) {
      setIsDialogOpen(false);
    }
    setDeleteTarget(null);
    toast({ title: "Usuário excluído" });
  };

  const toggleRole = (role: string) => {
    if (!canEditRoles) {
      return;
    }
    setFormState((prev) => {
      const hasRole = prev.roles.includes(role);
      return {
        ...prev,
        roles: hasRole ? prev.roles.filter((item) => item !== role) : [...prev.roles, role],
      };
    });
  };

  const handleSocialDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    if (!canEditBasicFields) {
      return;
    }
    setSocialDragIndex(index);
    setSocialDragOverIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleSocialDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    if (!canEditBasicFields || socialDragIndex === null) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (socialDragOverIndex !== index) {
      setSocialDragOverIndex(index);
    }
  };

  const handleSocialDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const from = socialDragIndex;
    if (!canEditBasicFields || from === null || from === index) {
      clearSocialDragState();
      return;
    }
    setFormState((prev) => ({
      ...prev,
      socials: reorderItems(prev.socials, from, index),
    }));
    clearSocialDragState();
  };

  const reorderUsers = (orderedActiveIds: string[], orderedRetiredIds: string[]) => {
    setUsers((prev) => {
      const activeMap = new Map(prev.filter((u) => u.status === "active").map((u) => [u.id, u]));
      const retiredMap = new Map(prev.filter((u) => u.status === "retired").map((u) => [u.id, u]));
      const reorderedActive = orderedActiveIds
        .map((id, index) => {
          const user = activeMap.get(id);
          return user ? { ...user, order: index } : null;
        })
        .filter(Boolean) as UserRecord[];
      const reorderedRetired = orderedRetiredIds
        .map((id, index) => {
          const user = retiredMap.get(id);
          return user ? { ...user, order: orderedActiveIds.length + index } : null;
        })
        .filter(Boolean) as UserRecord[];
      return [...reorderedActive, ...reorderedRetired];
    });
  };

  const handleDragOverActive = (event: React.DragEvent<HTMLDivElement>, overId: string) => {
    if (!canManageUsers || !dragId || dragGroup !== "active" || dragId === overId) {
      return;
    }
    event.preventDefault();
    const activeIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    const fromIndex = activeIds.indexOf(dragId);
    const toIndex = activeIds.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextActiveIds = [...activeIds];
    nextActiveIds.splice(fromIndex, 1);
    nextActiveIds.splice(toIndex, 0, dragId);
    reorderUsers(nextActiveIds, retiredIds);
  };

  const handleDragOverRetired = (event: React.DragEvent<HTMLDivElement>, overId: string) => {
    if (!canManageUsers || !dragId || dragGroup !== "retired" || dragId === overId) {
      return;
    }
    event.preventDefault();
    const activeIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    const fromIndex = retiredIds.indexOf(dragId);
    const toIndex = retiredIds.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const nextRetiredIds = [...retiredIds];
    nextRetiredIds.splice(fromIndex, 1);
    nextRetiredIds.splice(toIndex, 0, dragId);
    reorderUsers(activeIds, nextRetiredIds);
  };

  const handleDragEnd = async () => {
    if (!canManageUsers) {
      setDragId(null);
      setDragGroup(null);
      setDragUsersSnapshot(null);
      return;
    }
    const snapshot = dragUsersSnapshot;
    const changed = snapshot ? didUserOrderChange(snapshot, users) : false;
    if (!changed) {
      setDragId(null);
      setDragGroup(null);
      setDragUsersSnapshot(null);
      return;
    }
    const orderedIds = activeUsers.map((user) => user.id);
    const retiredIds = retiredUsers.map((user) => user.id);
    try {
      const response = await apiFetch(apiBase, "/api/users/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ orderedIds, retiredIds }),
      });
      if (!response.ok) {
        if (snapshot) {
          setUsers(snapshot);
        }
        toast({
          title: "Não foi possível salvar a nova ordem",
          description: "A lista foi restaurada para a ordem anterior.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ordem dos usuários atualizada",
          description: "A nova ordenação foi salva.",
          intent: "success",
        });
      }
    } catch {
      if (snapshot) {
        setUsers(snapshot);
      }
      toast({
        title: "Não foi possível salvar a nova ordem",
        description: "A lista foi restaurada para a ordem anterior.",
        variant: "destructive",
      });
    }
    setDragId(null);
    setDragGroup(null);
    setDragUsersSnapshot(null);
  };

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        onUserCardClick={currentUserRecord ? () => handleUserCardClick(currentUserRecord) : undefined}
      >
      <main className="pt-24">
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                  Usuários
                </div>
                <h1 className="mt-4 text-3xl font-semibold lg:text-4xl animate-slide-up">Gestão de Usuários</h1>
                <p
                  className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "0.2s" }}
                >
                  Reordene arrastando para refletir a ordem na página pública.
                </p>
              </div>
              {canManageUsers && (
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openNewDialog}>
                  Adicionar usuário
                </Button>
              )}
            </header>

            <div className="mt-10">

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Usuários ativos</h2>
                <Badge className="bg-card/80 text-muted-foreground">{activeUsers.length}</Badge>
              </div>

              {isLoading ? (
                <AsyncState
                  kind="loading"
                  title="Carregando usuarios"
                  description="Buscando membros e permissoes."
                  className="mt-6"
                />
              ) : hasLoadError ? (
                <AsyncState
                  kind="error"
                  title="Não foi possível carregar os usuários"
                  description="Tente novamente em instantes."
                  className="mt-6"
                  action={
                    <Button variant="outline" onClick={() => setLoadVersion((previous) => previous + 1)}>
                      Tentar novamente
                    </Button>
                  }
                />
              ) : activeUsers.length === 0 ? (
                <AsyncState
                  kind="empty"
                  title="Nenhum usuario ativo"
                  description="Adicione um novo membro para comecar."
                  className="mt-6"
                />
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {activeUsers.map((user, index) => {
                    const isLoneLastActiveCard =
                      activeUsers.length % 2 === 1 && index === activeUsers.length - 1;
                    return (
                    <div
                      key={user.id}
                      className={`relative rounded-2xl border border-border/60 bg-card/60 p-5 transition hover:border-primary/40 hover:bg-primary/5 animate-slide-up opacity-0 ${
                        isLoneLastActiveCard ? "md:col-span-2 md:mx-auto md:w-[calc(50%-0.5rem)]" : ""
                      }`}
                      style={{ animationDelay: `${index * 60}ms` }}
                      draggable={canManageUsers}
                      onDragStart={() => {
                        setDragUsersSnapshot((prev) =>
                          prev ? prev : users.map((userItem) => ({ ...userItem })),
                        );
                        setDragId(user.id);
                        setDragGroup("active");
                      }}
                      onDragOver={(event) => handleDragOverActive(event, user.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleUserCardClick(user)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleUserCardClick(user);
                        }
                      }}
                    >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <DashboardAvatar
                              avatarUrl={toAvatarRenderUrl(user.avatarUrl)}
                              name={user.name}
                              sizeClassName="h-14 w-14"
                              frameClassName="border border-border/60 bg-card/60"
                              fallbackClassName="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-card/80 text-sm text-foreground"
                              fallbackText={user.name.slice(0, 2).toUpperCase()}
                            />
                            <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{user.name}</h3>
                              {ownerIds.includes(user.id) && (
                                <Badge className="bg-primary/20 text-primary">Dono</Badge>
                              )}
                              {!ownerIds.includes(user.id) && isAdminRecord(user) && (
                                <Badge className="bg-card/80 text-muted-foreground">Administrador</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.phrase || "-"}</p>
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {user.bio || "Sem biografia cadastrada."}
                            </p>
                            {user.roles && user.roles.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(ownerIds.includes(user.id)
                                  ? user.roles
                                  : stripOwnerRole(user.roles)
                                ).map((role) => (
                                  <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}

              {retiredUsers.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Usuários aposentados</h2>
                    <Badge className="bg-card/80 text-muted-foreground">{retiredUsers.length}</Badge>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {retiredUsers.map((user, index) => {
                      const isLoneLastRetiredCard =
                        retiredUsers.length % 2 === 1 && index === retiredUsers.length - 1;
                      return (
                      <div
                        key={user.id}
                        className={`rounded-2xl border border-border/60 bg-card/60 p-5 animate-slide-up opacity-0 ${
                          isLoneLastRetiredCard ? "md:col-span-2 md:mx-auto md:w-[calc(50%-0.5rem)]" : ""
                        }`}
                        style={{ animationDelay: `${index * 60}ms` }}
                        draggable={canManageUsers}
                        onDragStart={() => {
                          setDragUsersSnapshot((prev) =>
                            prev ? prev : users.map((userItem) => ({ ...userItem })),
                          );
                          setDragId(user.id);
                          setDragGroup("retired");
                        }}
                        onDragOver={(event) => handleDragOverRetired(event, user.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleUserCardClick(user)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleUserCardClick(user);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <DashboardAvatar
                              avatarUrl={toAvatarRenderUrl(user.avatarUrl)}
                              name={user.name}
                              sizeClassName="h-14 w-14"
                              frameClassName="border border-border/60 bg-card/60"
                              fallbackClassName="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-card/80 text-sm text-foreground"
                              fallbackText={user.name.slice(0, 2).toUpperCase()}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">{user.name}</h3>
                                <Badge className="bg-card/80 text-muted-foreground">Aposentado</Badge>
                                {isAdminRecord(user) && (
                                  <Badge className="bg-card/80 text-muted-foreground">Administrador</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{user.phrase || "-"}</p>
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                                {user.bio || "Sem biografia cadastrada."}
                              </p>
                              {user.roles && user.roles.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(ownerIds.includes(user.id)
                                    ? user.roles
                                    : stripOwnerRole(user.roles)
                                  ).map((role) => (
                                    <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </DashboardShell>
      <Suspense fallback={null}>
        <ImageLibraryDialog
          open={isLibraryOpen}
          onOpenChange={handleLibraryOpenChange}
          apiBase={apiBase}
          description="Selecione uma imagem já enviada para reutilizar ou envie um novo arquivo."
          uploadFolder="users"
          listFolders={avatarLibraryFolders}
          listAll={false}
          allowDeselect
          mode="single"
          cropAvatar
          cropTargetFolder="users"
          cropSlot={formState.id ? `avatar-${formState.id}` : undefined}
          onSave={({ urls }) => handleLibrarySave({ urls })}
        />
      </Suspense>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="w-[92vw] max-h-[90vh] max-w-xl overflow-y-auto"
          overlayClassName="backdrop-blur-xs"
        >
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuário" : "Adicionar usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize as informações e permissões do usuário."
                : "Cadastre um novo usuário autorizado."}
            </DialogDescription>
          </DialogHeader>
          {basicProfileOnlyEdit && (
            <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
              Você só pode alterar informações básicas deste usuário.
            </div>
          )}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-id">ID do Discord</Label>
              <Input
                id="user-id"
                value={formState.id}
                onChange={(event) => setFormState((prev) => ({ ...prev, id: event.target.value }))}
                placeholder="Ex.: 380305493391966208"
                disabled={Boolean(editingUser) || !canManageUsers}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome exibido"
                disabled={!canEditBasicFields}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-phrase">Frase</Label>
              <Input
                id="user-phrase"
                value={formState.phrase}
                onChange={(event) => setFormState((prev) => ({ ...prev, phrase: event.target.value }))}
                placeholder="Frase curta"
                disabled={!canEditBasicFields}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-bio">Bio</Label>
              <Textarea
                id="user-bio"
                value={formState.bio}
                onChange={(event) => setFormState((prev) => ({ ...prev, bio: event.target.value }))}
                placeholder="Texto da bio"
                rows={4}
                disabled={!canEditBasicFields}
              />
            </div>
            <div className="grid gap-2">
              <Label>Avatar</Label>
              <div className="flex flex-wrap items-center gap-3">
                {formState.avatarUrl ? (
                  <DashboardAvatar
                    avatarUrl={toAvatarRenderUrl(formState.avatarUrl)}
                    name={formState.name || "Avatar"}
                    sizeClassName="h-12 w-12"
                    frameClassName="border border-border/60 bg-card/60"
                    fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/60 text-xs text-foreground"
                    fallbackText={(formState.name || "U").slice(0, 1).toUpperCase()}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border/60 text-[10px] text-muted-foreground">
                    Sem imagem
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openLibrary}
                  disabled={!canEditBasicFields}
                >
                  Biblioteca
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Links e redes</Label>
              <div className="grid gap-3">
                {formState.socials.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum link adicionado.</p>
                ) : null}
                {formState.socials.map((social, index) => (
                  <div
                    key={`${social.label}-${index}`}
                    data-testid={`user-social-row-${index}`}
                    className={`grid items-center gap-2 rounded-xl border p-2 transition md:grid-cols-[auto_1fr_2fr_auto] ${
                      socialDragOverIndex === index ? "border-primary/40 bg-primary/5" : "border-transparent"
                    }`}
                    onDragOver={(event) => handleSocialDragOver(event, index)}
                    onDrop={(event) => handleSocialDrop(event, index)}
                  >
                    <button
                      type="button"
                      draggable={canEditBasicFields}
                      className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition hover:border-primary/40 hover:text-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Arrastar rede ${social.label || index + 1}`}
                      onDragStart={(event) => handleSocialDragStart(event, index)}
                      onDragEnd={clearSocialDragState}
                      disabled={!canEditBasicFields}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <Select
                      value={social.label}
                      onValueChange={(value) =>
                        setFormState((prev) => {
                          const next = [...prev.socials];
                          next[index] = { ...next[index], label: value };
                          return { ...prev, socials: next };
                        })
                      }
                      disabled={!canEditBasicFields}
                    >
                      <SelectTrigger className="bg-background/60 justify-start text-left">
                        <SelectValue placeholder="Selecione a rede" />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {(linkTypes.length > 0 ? linkTypes : fallbackLinkTypes).map((option) => {
                          const isCustomIcon = isIconUrl(option.icon);
                          const Icon = !isCustomIcon ? socialIconMap[option.icon] || Globe : null;
                          return (
                            <SelectItem
                              key={option.id}
                              value={option.id}
                              className="pl-2 pr-2 [&>span:first-child]:hidden"
                            >
                              <div className="flex items-center gap-2">
                                {isCustomIcon ? (
                                  <ThemedSvgLogo
                                    url={option.icon}
                                    label={option.label}
                                    className="h-4 w-4 text-primary"
                                  />
                                ) : (
                                  <Icon className="h-4 w-4" />
                                )}
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Input
                      value={social.href}
                      onChange={(event) =>
                        setFormState((prev) => {
                          const next = [...prev.socials];
                          next[index] = { ...next[index], href: event.target.value };
                          return { ...prev, socials: next };
                        })
                      }
                      placeholder="https://"
                      disabled={!canEditBasicFields}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="justify-start md:justify-center"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          socials: prev.socials.filter((_, idx) => idx !== index),
                        }))
                      }
                      disabled={!canEditBasicFields}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      socials: [...prev.socials, { label: "", href: "" }],
                    }))
                  }
                  disabled={!canEditBasicFields}
                >
                  Adicionar link
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Funções</Label>
              {!canEditRoles && (
                <p className="text-xs text-muted-foreground">
                  Apenas donos com permissão de acesso podem alterar funções de equipe.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => {
                  const isSelected = formState.roles.includes(role);
                  const iconKey = roleIconMap.get(role);
                  const RoleIcon = iconKey ? roleIconRegistry[String(iconKey).toLowerCase()] : null;
                  return (
                    <Button
                      key={role}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      onClick={() => toggleRole(role)}
                      disabled={!canEditRoles}
                    >
                      {RoleIcon ? <RoleIcon className="h-4 w-4" /> : null}
                      {role}
                    </Button>
                  );
                })}
              </div>
              {isOwnerRecord && (
                <p className="text-xs text-muted-foreground">A badge de dono é automática.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Papel de acesso</Label>
              <Select
                value={formState.accessRole}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    accessRole: value === "admin" ? "admin" : "normal",
                    permissions:
                      value === "admin"
                        ? permissionOptions
                            .filter((option) =>
                              [
                                "posts",
                                "projetos",
                                "comentarios",
                                "paginas",
                                "uploads",
                                "analytics",
                                "usuarios_basico",
                              ].includes(option.id),
                            )
                            .map((option) => option.id)
                        : prev.permissions,
                  }))
                }
                disabled={!canEditAccessControls || isOwnerRecord}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  {accessRoleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isOwnerRecord ? (
                <p className="text-xs text-muted-foreground">
                  O papel de dono é definido pela governança de owners.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Permissões</Label>
              {isOwnerRecord && <Badge className="w-fit bg-primary/20 text-primary">Acesso total</Badge>}
              {!isOwnerRecord && isAdminForm && (
                <Badge className="w-fit bg-card/80 text-muted-foreground">Administrador</Badge>
              )}
              <div className="flex flex-wrap gap-2">
                {permissionOptions.map((permission) => {
                  const isSelected = effectivePermissions.includes(permission.id);
                  return (
                    <Button
                      key={permission.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className={isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                      onClick={() => togglePermission(permission.id)}
                      disabled={!canEditAccessControls || isOwnerRecord}
                    >
                      {permission.label}
                    </Button>
                  );
                })}
              </div>
              {!canEditAccessControls && (
                <p className="text-xs text-muted-foreground">
                  Apenas donos com permissão de acesso podem alterar permissões de acesso.
                </p>
              )}
            </div>
            {canManageUsers ? (
              <div className="grid gap-2">
                <Label>Dono</Label>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Permite acesso total ao painel e às configurações críticas.
                  </span>
                  <Switch
                    checked={ownerToggle}
                    onCheckedChange={setOwnerToggle}
                    disabled={!canManageOwners || isPrimaryOwnerRecord}
                  />
                </div>
                {!canManageOwners ? (
                  <p className="text-xs text-muted-foreground">
                    Apenas o primeiro dono pode promover ou rebaixar outros donos.
                  </p>
                ) : null}
                {isPrimaryOwnerRecord ? (
                  <p className="text-xs text-muted-foreground">
                    O primeiro dono não pode ser rebaixado.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  {formState.status === "active" ? "Ativo" : "Aposentado"}
                </span>
                <Switch
                  checked={formState.status === "active"}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, status: checked ? "active" : "retired" }))
                  }
                  disabled={!canEditStatus}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              {editingUser ? (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteTarget(editingUser)}
                  disabled={
                    !canManageUsers ||
                    isPrimaryOwnerRecord ||
                    editingUser.id === currentUser?.id ||
                    (isOwnerRecord && !canManageOwners)
                  }
                >
                  Excluir
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir usuário?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Excluir "${deleteTarget.name}"? Esta ação não pode ser desfeita.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardUsers;





